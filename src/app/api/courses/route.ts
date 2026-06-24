import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, appStatusToPrisma } from "@/lib/types";
import { checkCourseEligibilityBatch } from "@/lib/course-eligibility";
import type { CourseStatus, Role } from "@/lib/types";

/** GET /api/courses — course catalog.
 *  Employees see only PUBLISHED courses.
 *  Admin/Manager also see their own DRAFT courses.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";

  const isPrivileged =
    session.user.role === "admin" || session.user.role === "course_manager";

  // Non-privileged users only see published courses they are enrolled in.
  // Admins/managers see all published courses + their own drafts.
  const where = {
    ...(search
      ? { title: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(isPrivileged
      ? {
          OR: [
            { status: "PUBLISHED" as const },
            { createdById: session.user.id },
          ],
        }
      : {
          AND: [
            { status: "PUBLISHED" as const },
            { enrollments: { some: { userId: session.user.id } } },
          ],
        }),
  };

  const courses = await prisma.course.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Batch-check eligibility for the current user — one bounded set of queries
  // regardless of course count (vs 2N–4N from a per-course Promise.all).
  const userId = session.user.id ?? "";
  const role = session.user.role as Role;
  const eligibilityByCourse = await checkCourseEligibilityBatch(
    userId,
    role,
    courses.map((c) => c.id),
  );

  return NextResponse.json(
    courses.map((c) => {
      const elig = eligibilityByCourse.get(c.id) ?? {
        eligible: true,
        missingPrerequisites: [],
        clearanceLocked: false,
        clearanceHint: null,
      };
      let lockReason: string | undefined;
      if (!elig.eligible) {
        const parts: string[] = [];
        if (elig.missingPrerequisites.length > 0) {
          parts.push(
            `Complete prerequisites: ${elig.missingPrerequisites.map((p) => p.title).join(", ")}`,
          );
        }
        if (elig.clearanceLocked && elig.clearanceHint) {
          parts.push(`Requires clearance: ${elig.clearanceHint}`);
        } else if (elig.clearanceLocked) {
          parts.push("Requires additional clearance");
        }
        lockReason = parts.join(". ");
      }
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail,
        status: prismaStatusToApp(c.status),
        category: c.category,
        locked: !elig.eligible,
        lockReason,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    }),
  );
}

/** POST /api/courses — create a course (admin/manager only). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "course_manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const title = (body.title as string)?.trim();
  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  const status: CourseStatus = body.status || "draft";
  if (!["draft", "published", "archived"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status" },
      { status: 400 }
    );
  }

  const course = await prisma.course.create({
    data: {
      title,
      description: body.description?.trim() || null,
      thumbnail: body.thumbnail?.trim() || null,
      status: appStatusToPrisma(status),
      createdById: session.user.id,
      nodeId: body.nodeId?.trim() || null,
      // Auto-link the creator as a manager so they can immediately edit
      // their own course. canManageCourse() checks the CourseManagers m2m,
      // not createdById, so without this a CM who creates a course gets a
      // 404 the moment they click "Edit".
      managers: { connect: { id: session.user.id } },
    },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json(
    {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      status: prismaStatusToApp(course.status),
      createdBy: course.createdBy,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    },
    { status: 201 }
  );
}
