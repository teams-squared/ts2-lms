/**
 * Enrollment module-scope helpers — the single source of truth for the
 * scoping invariant:
 *
 *   INVARIANT: zero EnrollmentModule rows for an enrollment = whole course.
 *              one or more rows = restricted to exactly those modules.
 *
 * Scope drives: module visibility (player + lesson sidebar + access checks),
 * the student's own progress denominator, module completion, and deadline
 * reminders. Scope does NOT affect course completion — Enrollment.completedAt
 * stays "all course modules done", so a scoped student simply never reaches it.
 *
 * Callers load `scopedModules: { select: { moduleId: true } }` on the
 * enrollment and route the loaded modules through these helpers; no extra
 * round-trips needed.
 */

/**
 * Resolve scope rows into a Set of module IDs, or `null` when the enrollment
 * has no rows (= whole course). `null` is the "all modules" sentinel used by
 * every consumer here.
 */
export function scopeSetFromRows(
  rows: { moduleId: string }[] | null | undefined,
): Set<string> | null {
  if (!rows || rows.length === 0) return null;
  return new Set(rows.map((r) => r.moduleId));
}

/**
 * Filter a list of modules down to the enrollment's scope. A `null` scope
 * (whole course) returns the list unchanged.
 */
export function filterModulesByScope<T extends { id: string }>(
  modules: T[],
  scope: Set<string> | null,
): T[] {
  if (scope === null) return modules;
  return modules.filter((m) => scope.has(m.id));
}

/**
 * Whether a single module is visible under the given scope. A `null` scope
 * (whole course) includes every module.
 */
export function isModuleInScope(
  moduleId: string,
  scope: Set<string> | null,
): boolean {
  return scope === null || scope.has(moduleId);
}
