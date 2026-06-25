/**
 * Audited-action constants — deliberately free of server-only imports (no
 * prisma) so client components (e.g. the audit-log filter dropdown) can import
 * them without pulling the DB client into the browser bundle. `src/lib/audit.ts`
 * re-exports these for server callers.
 *
 * Closed set of audited actions — keep in sync with the routes that emit them.
 * The AuditAction type is derived from the array so the two stay in lock-step.
 */
export const AUDIT_ACTIONS = [
  "session.login",
  "session.login_failed",
  "user.role_changed",
  "user.deleted",
  "user.offboarded",
  "user.reactivated",
  "user.invited",
  "clearance.granted",
  "clearance.revoked",
  "enrollment.created",
  "enrollment.deleted",
  "enrollment.reset",
  "enrollment.scope_updated",
  "course.updated",
  "course.deleted",
  "course.reminder_sent",
  "course_manager.granted",
  "course_manager.revoked",
  "node.created",
  "node.updated",
  "node.deleted",
  "sector.created",
  "sector.updated",
  "sector.deleted",
  "policy_doc.synced",
  "iso_doc.created",
  "iso_doc.updated",
  "iso_doc.deleted",
  "iso_doc.synced",
  "setting.updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = [
  "user",
  "course",
  "enrollment",
  "clearance",
  "session",
  "node",
  "sector",
  "policy_doc",
  "setting",
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];
