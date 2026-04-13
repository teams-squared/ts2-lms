import { Role as PrismaRole } from "@prisma/client";

export type Role = "admin" | "manager" | "employee";

const PRISMA_ROLE_MAP: Record<PrismaRole, Role> = {
  ADMIN: "admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
};

const APP_ROLE_MAP: Record<Role, PrismaRole> = {
  admin: "ADMIN",
  manager: "MANAGER",
  employee: "EMPLOYEE",
};

export function prismaRoleToApp(role: PrismaRole): Role {
  return PRISMA_ROLE_MAP[role];
}

export function appRoleToPrisma(role: Role): PrismaRole {
  return APP_ROLE_MAP[role];
}
