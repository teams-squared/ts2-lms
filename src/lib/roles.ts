import type { Role } from "./types";
import rolesConfig from "@/content/_roles.json";

const ROLE_LEVEL: Record<Role, number> = {
  employee: 1,
  manager: 2,
  admin: 3,
};

export function hasAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}

export function getUserRole(email: string): Role {
  if (rolesConfig.admins.includes(email)) return "admin";
  if (rolesConfig.managers.includes(email)) return "manager";
  return rolesConfig.defaultRole as Role;
}
