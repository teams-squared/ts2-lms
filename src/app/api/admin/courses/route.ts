import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { listManagedCourseIds } from "@/lib/courseAccess";
import { prismaStatusToApp } from "@/lib/types";

/** GET /api/admin/courses — admin: all courses; course_manager: managed courses only. */
export async function GET() {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const managedIds = await listManagedCourseIds(userId, role);
  const where = managedIds === null ? {} : { id: { in: managedIds } };

  const courses = await prisma.course.findMany({
    where,
    include: {
      createdBy: { select: { name: true, email: true } },
      node: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      status: prismaStatusToApp(c.status),
      createdBy: c.createdBy,
      node: c.node ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  );
}
