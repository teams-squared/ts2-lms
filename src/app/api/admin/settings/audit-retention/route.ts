import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";

const SINGLETON_ID = "singleton";

/**
 * Audit-log retention legal-hold control (admin-only).
 *
 * GET  — current pause state.
 * PATCH — set/clear `prunePaused`. When paused, the prune-audit-logs cron skips
 *         deletion entirely, preserving logs tied to an open investigation or
 *         active ISO audit (ISO 27001 A.5.33 / A.8.15). Every toggle is itself
 *         written to the audit trail so the control is self-evidencing.
 */

const PatchSchema = z.object({
  prunePaused: z.boolean(),
  // Optional free-text reason for the hold (e.g. "ISO audit 2026-Q3", "case #42").
  pauseReason: z.string().trim().max(500).optional(),
});

export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const settings = await prisma.auditRetentionSettings.findUnique({
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({
    // No row yet → pruning runs normally (not paused).
    prunePaused: settings?.prunePaused ?? false,
    pauseReason: settings?.pauseReason ?? null,
    updatedAt: settings?.updatedAt ?? null,
    updatedBy: settings?.updatedBy ?? null,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const prunePaused = parsed.data.prunePaused;
  // Clear the reason when resuming so a stale hold note can't linger.
  const pauseReason = prunePaused ? (parsed.data.pauseReason ?? null) : null;

  const updated = await prisma.auditRetentionSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      prunePaused,
      pauseReason,
      updatedBy: auth.userId,
    },
    update: {
      prunePaused,
      pauseReason,
      updatedBy: auth.userId,
    },
  });

  await writeAuditLog({
    action: "setting.updated",
    actorId: auth.userId,
    actorEmail: auth.session?.user?.email,
    targetType: "setting",
    targetId: "audit_retention",
    metadata: { prunePaused, pauseReason },
  });

  return NextResponse.json({
    prunePaused: updated.prunePaused,
    pauseReason: updated.pauseReason,
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedBy,
  });
}
