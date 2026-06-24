import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { prismaRoleToApp, appRoleToPrisma } from "@/lib/types";
import type { Role } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";
import { ACTIVE_USER } from "@/lib/users";

export async function GET() {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const users = await prisma.user.findMany({
    where: { ...ACTIVE_USER },
    select: { id: true, email: true, name: true, avatar: true, role: true, createdAt: true },
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

  if (!userId || !["admin", "course_manager", "employee"].includes(role)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Snapshot the prior role for the audit trail before overwriting it.
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: appRoleToPrisma(role) },
    select: { id: true, email: true, name: true, avatar: true, role: true, createdAt: true },
  });

  await writeAuditLog({
    action: "user.role_changed",
    actorId: authResult.userId,
    actorEmail: authResult.session?.user?.email,
    targetType: "user",
    targetId: updated.id,
    metadata: {
      targetEmail: updated.email,
      oldRole: before ? prismaRoleToApp(before.role) : null,
      newRole: role,
    },
  });

  return NextResponse.json({
    ...updated,
    role: prismaRoleToApp(updated.role),
  });
}
