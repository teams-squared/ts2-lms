import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp, appStatusToPrisma } from "@/lib/types";
import type { CourseStatus } from "@/lib/types";

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
    session.user.role === "admin" || session.user.role === "manager";

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
      : { status: "PUBLISHED" as const }),
  };

  const courses = await prisma.course.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
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
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  );
}

/** POST /api/courses — create a course (admin/manager only). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin" && session.user.role !== "manager") {
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
