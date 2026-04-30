import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { prismaRoleToApp } from "@/lib/types";
import { trackEvent } from "@/lib/posthog-server";

type Params = { params: Promise<{ userId: string }> };

/** GET /api/admin/users/[userId] — fetch user details */
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    role: prismaRoleToApp(user.role),
  });
}

/**
 * DELETE /api/admin/users/[userId] — permanently remove a user.
 *
 * Cascade handles most child data (enrollments, progress, quiz attempts,
 * notifications, achievements, stats, clearances). The non-cascading FKs
 * are RESTRICT — `Course.createdById` and `PolicyDocLesson.lastSyncedById`
 * — so authored courses and policy-doc sync history are reassigned to
 * the deleting admin inside the same transaction.
 *
 * Guards:
 *  - Must be ADMIN (stricter than course_manager).
 *  - Cannot delete self.
 *  - Cannot delete the last remaining ADMIN.
 *
 * Note: SSO will re-provision the user on next login (auth.ts upserts by
 * email). This is accepted behaviour — "remove" is about data, not ban.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: deletingAdminId } = authResult;

  const { userId } = await params;

  if (userId === deletingAdminId) {
    return NextResponse.json(
      { error: "You cannot remove your own account" },
      { status: 409 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last admin" },
        { status: 409 },
      );
    }
  }

  // Counts for response body + audit payload.
  const [enrollmentCount, authoredCount, policyDocSyncCount] = await Promise.all([
    prisma.enrollment.count({ where: { userId } }),
    prisma.course.count({ where: { createdById: userId } }),
    prisma.policyDocLesson.count({ where: { lastSyncedById: userId } }),
  ]);

  await prisma.$transaction(async (tx) => {
    // Reassign authored courses to the deleting admin — must happen before
    // the user delete because Course.createdById is non-null and defaults
    // to RESTRICT. updateMany is a no-op when authoredCount === 0.
    await tx.course.updateMany({
      where: { createdById: userId },
      data: { createdById: deletingAdminId },
    });
    // Reassign policy-doc sync history to the deleting admin — same
    // RESTRICT FK reasoning as Course above. updateMany is a no-op when
    // policyDocSyncCount === 0.
    await tx.policyDocLesson.updateMany({
      where: { lastSyncedById: userId },
      data: { lastSyncedById: deletingAdminId },
    });
    await tx.user.delete({ where: { id: userId } });
  });

  trackEvent(deletingAdminId, "user_removed", {
    targetId: userId,
    targetEmail: target.email,
    targetRole: target.role,
    reassignedCourseCount: authoredCount,
    reassignedPolicyDocSyncCount: policyDocSyncCount,
    enrollmentCount,
  });

  return NextResponse.json({
    deleted: true,
    reassignedCourseCount: authoredCount,
    reassignedPolicyDocSyncCount: policyDocSyncCount,
    enrollmentCount,
  });
}
