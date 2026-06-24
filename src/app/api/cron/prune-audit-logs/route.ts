import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Constant-time bearer-token comparison. Falls back to false on length
 *  mismatch (timingSafeEqual throws when buffer lengths differ, which is
 *  itself a side channel). Mirrors the check in cron/deadline-reminders. */
function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export const dynamic = "force-dynamic";

/**
 * Audit-log retention (ISO 27001 A.5.33 / data minimisation).
 *
 * Deletes AuditLog rows older than the retention window. Scoped to AuditLog
 * ONLY — the actual ISO ack/compliance evidence lives in LessonProgress and
 * is deliberately never touched here.
 *
 * Window is AUDIT_LOG_RETENTION_DAYS (default 365). The org's ISMS retention
 * register is the source of truth; bump the env var if the documented period
 * changes — no code change needed.
 *
 * Legal hold: if AuditRetentionSettings.prunePaused is true, this cron skips
 * deletion entirely so logs tied to an open investigation or active ISO audit
 * survive past the window. Admins toggle the hold via
 * /api/admin/settings/audit-retention; the toggle is itself audited.
 */
const DEFAULT_RETENTION_DAYS = 365;

function retentionDays(): number {
  const raw = Number(process.env.AUDIT_LOG_RETENTION_DAYS);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_RETENTION_DAYS;
}

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

  const days = retentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    // Legal hold — skip the prune entirely while a hold is active so evidence
    // tied to an open investigation / ISO audit is preserved past the window.
    const hold = await prisma.auditRetentionSettings.findUnique({
      where: { id: "singleton" },
    });
    if (hold?.prunePaused) {
      return NextResponse.json({
        skipped: true,
        reason: "legal-hold active (prunePaused)",
        pauseReason: hold.pauseReason ?? null,
        retentionDays: days,
        cutoff: cutoff.toISOString(),
      });
    }

    if (dryRun) {
      const wouldDelete = await prisma.auditLog.count({
        where: { createdAt: { lt: cutoff } },
      });
      return NextResponse.json({
        dryRun: true,
        retentionDays: days,
        cutoff: cutoff.toISOString(),
        wouldDelete,
      });
    }

    const { count } = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return NextResponse.json({
      deleted: count,
      retentionDays: days,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error("[cron/prune-audit-logs] error:", err);
    return NextResponse.json({ error: "Prune failed" }, { status: 500 });
  }
}
