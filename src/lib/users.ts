/**
 * Shared "active user" query fragments for the offboarding feature.
 *
 * An offboarded user (`offboardedAt != null`) keeps all their rows — enrollments,
 * lesson progress, quiz attempts, audit trail — so history survives for posterity.
 * They are simply no longer treated as active: excluded from user lists,
 * assignment dropdowns, analytics counts, deadline reminders, and ISO/compliance
 * coverage. Spread these fragments into the relevant Prisma `where` clauses so the
 * definition of "active" lives in one place.
 */

/** Users who have not been offboarded. Spread into a `user` where-clause. */
export const ACTIVE_USER = { offboardedAt: null } as const;

/**
 * Enrollment/progress rows whose related user is still active. Spread into an
 * `enrollment` (or any model with a `user` relation) where-clause.
 */
export const ACTIVE_ENROLLMENT_USER = { user: { offboardedAt: null } } as const;
