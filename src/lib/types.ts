export type Role = "admin" | "manager" | "employee";

export interface RoleConfig {
  admins: string[];
  managers: string[];
  defaultRole: string;
}

export interface DocMeta {
  title: string;
  description: string;
  slug: string;
  category: string;
  minRole: Role;
  updatedAt: string;
  author?: string;
  tags?: string[];
  order?: number;
  passwordProtected?: boolean;
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  icon: string;
  minRole: Role;
  parentCategory?: string;
  order?: number;
}
