import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaRoleToApp } from "@/lib/types";

type Params = { params: Promise<{ userId: string }> };

/** GET /api/admin/users/[userId] — fetch user details with instructor course assignments */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      instructedCourses: {
        select: {
          assignedAt: true,
          course: { select: { id: true, title: true, status: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    role: prismaRoleToApp(user.role),
    instructedCourses: user.instructedCourses.map((ic) => ({
      assignedAt: ic.assignedAt,
      course: ic.course,
    })),
  });
}
