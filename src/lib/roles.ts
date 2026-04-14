import { prisma } from "./prisma";
import { prismaRoleToApp } from "./types";
import type { Role } from "./types";

const ROLE_LEVEL: Record<Role, number> = {
  employee: 1,
  instructor: 2,
  manager: 3,
  admin: 4,
};

export function hasAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}

export async function getUserRole(email: string): Promise<Role> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  return user ? prismaRoleToApp(user.role) : "employee";
}
