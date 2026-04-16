import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { prismaRoleToApp, appRoleToPrisma } from "@/lib/types";
import type { Role } from "@/lib/types";

export async function GET() {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      role: prismaRoleToApp(u.role),
    }))
  );
}

export async function PATCH(request: Request) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId, role } = (await request.json()) as {
    userId: string;
    role: Role;
  };

  if (!userId || !["admin", "manager", "instructor", "employee"].includes(role)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: appRoleToPrisma(role) },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json({
    ...updated,
    role: prismaRoleToApp(updated.role),
  });
}
