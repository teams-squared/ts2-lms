import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { listEnabledTenantEmails } from "@/lib/entra/graph";
import { ACTIVE_USER } from "@/lib/users";
import { writeAuditLog } from "@/lib/audit";

/** Constant-time bearer-token comparison. Falls back to false on length
 *  mismatch (timingSafeEqual throws when buffer lengths differ, which is
 *  itself a side channel). Mirrors the check in cron/prune-audit-logs. */
function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export const dynamic = "force-dynamic";

/**
 * Entra → LMS offboarding auto-sync.
 *
 * Fetches every enabled Entra account (mail + UPN), compares against active
 * LMS users, and marks anyone missing from Entra as offboarded. Each user is
 * updated in its own transaction so the audit row is atomic with the status
 * change.
 *
 * Fails closed: if the Graph call returns null (any error, missing creds, etc.)
 * the route returns 200 with `skipped: "graph_unavailable"` and offboards
 * nobody. Same for a suspiciously small enabled-set (sanity guard).
 */
export async function GET(req: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (
    !authHeader.startsWith("Bearer ") ||
    !constantTimeEqual(authHeader.slice(7), cronSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    // Step 1: fetch enabled Entra accounts — fail closed on null.
    const enabled = await listEnabledTenantEmails();
    if (enabled === null) {
      return NextResponse.json({ skipped: "graph_unavailable" });
    }

    // Step 2: fetch active LMS users.
    const activeUsers = await prisma.user.findMany({
      where: ACTIVE_USER,
      select: { id: true, email: true },
    });

    // Step 3: sanity guard — if the enabled set is less than 50% of active LMS
    // users something is very wrong (truncated Graph result, wrong tenant, etc.).
    if (enabled.size < Math.ceil(activeUsers.length * 0.5)) {
      return NextResponse.json({
        skipped: "enabled_set_too_small",
        enabledCount: enabled.size,
        activeCount: activeUsers.length,
      });
    }

    // Step 4: candidates = active LMS users not present in the enabled set.
    const candidates = activeUsers.filter(
      (u) => !enabled.has(u.email.toLowerCase()),
    );

    // Step 5: dry-run path — report without writing.
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        scanned: activeUsers.length,
        enabledCount: enabled.size,
        wouldOffboard: candidates.map((c) => c.email),
      });
    }

    // Step 6: offboard each candidate atomically (one tx per user).
    const now = new Date();
    for (const c of candidates) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: c.id },
          data: { offboardedAt: now },
        });
        await writeAuditLog(
          {
            action: "user.offboarded",
            actorId: null,
            targetType: "user",
            targetId: c.id,
            metadata: {
              targetEmail: c.email,
              source: "entra-sync",
              reason: "disabled_or_deleted",
            },
          },
          tx,
        );
      });
    }

    // Step 7: return summary.
    return NextResponse.json({
      offboarded: candidates.map((c) => c.email),
      scanned: activeUsers.length,
      enabledCount: enabled.size,
    });
  } catch (err) {
    console.error("[cron/entra-offboard-sync] error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
