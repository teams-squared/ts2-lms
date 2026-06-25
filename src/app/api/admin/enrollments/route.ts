import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { canManageCourse, listManagedCourseIds } from "@/lib/courseAccess";
import { modulesNotInCourse } from "@/lib/enrollments";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { writeAuditLog } from "@/lib/audit";
import { ACTIVE_ENROLLMENT_USER } from "@/lib/users";

/** GET /api/admin/enrollments — list enrollments (scoped to managed courses for course_manager). */
export async function GET() {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const managedIds = await listManagedCourseIds(userId, role);
  const where =
    managedIds === null
      ? { ...ACTIVE_ENROLLMENT_USER }
      : { courseId: { in: managedIds }, ...ACTIVE_ENROLLMENT_USER };

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return NextResponse.json(enrollments);
}

/** POST /api/admin/enrollments — enroll a user in a course (course_manager must manage it). */
export async function POST(request: Request) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: enrolledBy, role } = authResult;

  let body: { courseId?: string; userId?: string; moduleIds?: string[] };
  try {
    body = (await request.json()) as {
      courseId?: string;
      userId?: string;
      moduleIds?: string[];
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { courseId, userId } = body;
  if (!courseId || !userId) {
    return NextResponse.json(
      { error: "courseId and userId are required" },
      { status: 400 },
    );
  }

  // Optional module scope. Omitted/empty = whole course (no EnrollmentModule
  // rows). When present, each ID must belong to this course.
  const moduleIds = Array.isArray(body.moduleIds)
    ? [...new Set(body.moduleIds)]
    : [];

  // Verify course exists
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Validate scope (if any) before doing any writes.
  if (moduleIds.length > 0) {
    const invalid = await modulesNotInCourse(courseId, moduleIds);
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Some modules do not belong to this course", invalid },
        { status: 400 },
      );
    }
  }

  // Course managers may only enroll into courses they manage.
  const allowed = await canManageCourse(enrolledBy, role, courseId);
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only enroll users in courses you manage" },
      { status: 403 },
    );
  }

  // Verify user exists and is not offboarded
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, offboardedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.offboardedAt != null) {
    return NextResponse.json(
      { error: "Cannot enroll an offboarded user" },
      { status: 409 },
    );
  }

  // Check if already enrolled
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already enrolled in this course" },
      { status: 409 },
    );
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      userId,
      courseId,
      enrolledById: enrolledBy,
      ...(moduleIds.length > 0
        ? { scopedModules: { create: moduleIds.map((moduleId) => ({ moduleId })) } }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  // Send notification to the enrolled user
  await prisma.notification.create({
    data: {
      userId,
      type: "enrollment",
      message: `You have been enrolled in "${course.title}"`,
      courseId,
    },
  });

  // Award XP and track event
  const { newAchievements } = await awardXp(userId, 5);
  trackEvent(userId, "course_enrolled", { courseId, enrolledBy });

  await writeAuditLog({
    action: "enrollment.created",
    actorId: enrolledBy,
    actorEmail: authResult.session?.user?.email,
    targetType: "enrollment",
    targetId: enrollment.id,
    metadata: {
      enrolledUserId: userId,
      courseId,
      courseTitle: course.title,
      scopedModuleIds: moduleIds.length > 0 ? moduleIds : undefined,
    },
  });

  return NextResponse.json(
    {
      ...enrollment,
      xpAwarded: 5,
      newAchievements: newAchievements.map((a) => ({
        key: a.key,
        title: a.title,
        icon: a.icon,
      })),
    },
    { status: 201 },
  );
}
