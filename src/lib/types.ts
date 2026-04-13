import { Role as PrismaRole, CourseStatus as PrismaCourseStatus } from "@prisma/client";

export type Role = "admin" | "manager" | "employee";
export type CourseStatus = "draft" | "published" | "archived";

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

// ─── CourseStatus mapping ───────────────────────────────────────────────────

const PRISMA_STATUS_MAP: Record<PrismaCourseStatus, CourseStatus> = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

const APP_STATUS_MAP: Record<CourseStatus, PrismaCourseStatus> = {
  draft: "DRAFT",
  published: "PUBLISHED",
  archived: "ARCHIVED",
};

export function prismaStatusToApp(status: PrismaCourseStatus): CourseStatus {
  return PRISMA_STATUS_MAP[status];
}

export function appStatusToPrisma(status: CourseStatus): PrismaCourseStatus {
  return APP_STATUS_MAP[status];
}
