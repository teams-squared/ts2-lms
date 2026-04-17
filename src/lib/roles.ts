import { NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { prismaRoleToApp } from "./types";
import type { Role } from "./types";
import type { Session } from "next-auth";

const ROLE_LEVEL: Record<Role, number> = {
  employee: 1,
  course_manager: 3,
  admin: 4,
};

export function hasAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}

export type AuthResult = {
  session: Session;
  userId: string;
  role: Role;
};

/**
 * Requires the user to be authenticated.
 * Returns session data or a 401 NextResponse.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return {
    session,
    userId: session.user.id,
    role: (session.user.role ?? "employee") as Role,
  };
}

/**
 * Requires the user to have at least the given role level.
 * Returns session data or a 401/403 NextResponse.
 */
export async function requireRole(minimumRole: Role): Promise<AuthResult | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (!hasAccess(result.role, minimumRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

export async function getUserRole(email: string): Promise<Role> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  return user ? prismaRoleToApp(user.role) : "employee";
}
