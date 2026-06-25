import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { canManageCourse } from "@/lib/courseAccess";
import { modulesNotInCourse, maybeCompleteModule } from "@/lib/enrollments";
import { trackEvent } from "@/lib/posthog-server";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ userId: string; courseId: string }> };

/**
 * PUT /api/admin/users/[userId]/enrollments/[courseId]/modules
 *
 * Replace the module scope of an existing enrollment (replace-set semantics).
 *
 * Body: { moduleIds: string[] }
 *   - non-empty → restrict the learner to exactly those modules
 *   - empty []  → promote to whole course (delete all EnrollmentModule rows)
 *
 * Course completion (enrollment.completedAt) is course-wide and NOT touched
 * here — changing scope can't change which lessons are done. For any module
 * newly brought into scope whose lessons are already all complete, we fire the
 * (idempotent) module-completion check so the achievement isn't missed.
 *
 * course_manager must manage the course.
 */
export async function PUT(request: Request, { params }: Params) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: actorId, role } = authResult;

  const { userId, courseId } = await params;

  let body: { moduleIds?: unknown };
  try {
    body = (await request.json()) as { moduleIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.moduleIds)) {
    return NextResponse.json(
      { error: "moduleIds (array) is required; use [] for whole course" },
      { status: 400 },
    );
  }
  const moduleIds = [...new Set(body.moduleIds.filter((m): m is string => typeof m === "string"))];

  const allowed = await canManageCourse(actorId, role, courseId);
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only manage enrollments for courses you manage" },
      { status: 403 },
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, course: { select: { title: true } } },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  if (moduleIds.length > 0) {
    const invalid = await modulesNotInCourse(courseId, moduleIds);
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Some modules do not belong to this course", invalid },
        { status: 400 },
      );
    }
  }

  // Replace the scope set atomically.
  await prisma.$transaction(async (tx) => {
    await tx.enrollmentModule.deleteMany({
      where: { enrollmentId: enrollment.id },
    });
    if (moduleIds.length > 0) {
      await tx.enrollmentModule.createMany({
        data: moduleIds.map((moduleId) => ({
          enrollmentId: enrollment.id,
          moduleId,
        })),
      });
    }
  });

  // Backfill module-completion for newly in-scope modules already fully done
  // (idempotent — no-ops if already stamped or not yet complete).
  const now = new Date();
  const targetModuleIds =
    moduleIds.length > 0
      ? moduleIds
      : (
          await prisma.module.findMany({
            where: { courseId },
            select: { id: true },
          })
        ).map((m) => m.id);
  for (const moduleId of targetModuleIds) {
    await maybeCompleteModule(userId, moduleId, now);
  }

  trackEvent(actorId, "enrollment_scope_updated", {
    targetUserId: userId,
    courseId,
    moduleCount: moduleIds.length,
    wholeCourse: moduleIds.length === 0,
  });

  await writeAuditLog({
    action: "enrollment.scope_updated",
    actorId,
    actorEmail: authResult.session?.user?.email,
    targetType: "enrollment",
    targetId: enrollment.id,
    metadata: {
      targetUserId: userId,
      courseId,
      courseTitle: enrollment.course.title,
      scopedModuleIds: moduleIds.length > 0 ? moduleIds : undefined,
      wholeCourse: moduleIds.length === 0,
    },
  });

  return NextResponse.json({
    updated: true,
    wholeCourse: moduleIds.length === 0,
    scopedModuleIds: moduleIds,
  });
}
