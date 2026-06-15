import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Centralised security audit trail (ISO 27001 A.8.15 / A.5.28).
 *
 * Every sensitive mutation writes one append-only row via writeAuditLog().
 * The write is best-effort: a logging failure is recorded to the server
 * console but never throws, so it cannot break the action being audited.
 * For the highest-stakes action (user deletion) the caller may instead pass
 * a transaction client so the audit row commits atomically with the delete.
 */

/** Closed set of audited actions — keep in sync with the routes that emit them. */
export type AuditAction =
  | "session.login"
  | "session.login_failed"
  | "user.role_changed"
  | "user.deleted"
  | "clearance.granted"
  | "clearance.revoked"
  | "enrollment.created"
  | "enrollment.deleted";

export type AuditTargetType =
  | "user"
  | "course"
  | "enrollment"
  | "clearance"
  | "session";

export type AuditEntry = {
  action: AuditAction;
  /** Actor who performed the action; null for system/cron or unauthenticated. */
  actorId?: string | null;
  /** Snapshot of the actor's email so the trail survives actor deletion. */
  actorEmail?: string | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

/** Minimal surface shared by PrismaClient and a $transaction client. */
type AuditClient = Pick<PrismaClient, "auditLog">;

/**
 * Write one audit-log row. Best-effort by default (errors are swallowed after
 * logging). Pass a transaction client as `client` to make the write atomic
 * with the surrounding operation — in that mode failures DO propagate so the
 * transaction rolls back together.
 */
export async function writeAuditLog(
  entry: AuditEntry,
  client?: AuditClient,
): Promise<void> {
  const data = {
    action: entry.action,
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? undefined,
  };

  if (client) {
    // Transactional mode — let failures propagate to roll back the caller.
    await client.auditLog.create({ data });
    return;
  }

  try {
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error(`[audit] write failed for action="${entry.action}":`, err);
  }
}
