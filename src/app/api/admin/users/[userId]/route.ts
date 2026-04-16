import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { prismaRoleToApp } from "@/lib/types";

type Params = { params: Promise<{ userId: string }> };

/** GET /api/admin/users/[userId] — fetch user details with instructor course assignments */
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
