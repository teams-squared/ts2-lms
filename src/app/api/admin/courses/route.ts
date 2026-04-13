import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaStatusToApp } from "@/lib/types";

/** GET /api/admin/courses — all courses regardless of status (admin only). */
export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courses = await prisma.course.findMany({
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
