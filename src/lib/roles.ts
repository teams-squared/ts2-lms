import type { Role } from "./types";

const ROLE_LEVEL: Record<Role, number> = {
  employee: 1,
  manager: 2,
  admin: 3,
};

export function hasAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}

export async function getUserRole(email: string): Promise<Role> {
  // Dynamic import to avoid pulling fs/path into Edge Runtime
  const { getRoleConfig } = await import("./role-store");
  const config = await getRoleConfig();
  if (config.admins.includes(email)) return "admin";
  if (config.managers.includes(email)) return "manager";
  return config.defaultRole as Role;
}
