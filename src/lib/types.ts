export type Role = "admin" | "manager" | "employee";

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
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  icon: string;
  minRole: Role;
}
