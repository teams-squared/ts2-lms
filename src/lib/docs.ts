import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { Category, DocMeta, Role } from "./types";
import { hasAccess } from "./roles";

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

export function getCategories(): Category[] {
  const filePath = path.join(CONTENT_DIR, "_categories.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export function getAccessibleCategories(userRole: Role): Category[] {
  return getCategories().filter((cat) => hasAccess(userRole, cat.minRole));
}

export function getDocsByCategory(
  categorySlug: string,
  userRole?: Role
): DocMeta[] {
  const categoryDir = path.join(CONTENT_DIR, categorySlug);
  if (!fs.existsSync(categoryDir)) return [];

  const files = fs
    .readdirSync(categoryDir)
    .filter((f) => f.endsWith(".mdx"));

  const docs: DocMeta[] = files.map((file) => {
    const filePath = path.join(categoryDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    return {
      title: data.title || file.replace(".mdx", ""),
      description: data.description || "",
      slug: file.replace(".mdx", ""),
      category: categorySlug,
      minRole: data.minRole || "employee",
      updatedAt: data.updatedAt || "",
      author: data.author,
      tags: data.tags || [],
      order: data.order || 0,
    };
  });

  const filtered = userRole
    ? docs.filter((doc) => hasAccess(userRole, doc.minRole))
    : docs;

  return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getDocContent(
  category: string,
  slug: string
): { meta: DocMeta; content: string } | null {
  const filePath = path.join(CONTENT_DIR, category, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    meta: {
      title: data.title || slug,
      description: data.description || "",
      slug,
      category,
      minRole: data.minRole || "employee",
      updatedAt: data.updatedAt || "",
      author: data.author,
      tags: data.tags || [],
      order: data.order || 0,
    },
    content,
  };
}

export function getAllDocs(): DocMeta[] {
  const categories = getCategories();
  const allDocs: DocMeta[] = [];

  for (const cat of categories) {
    const docs = getDocsByCategory(cat.slug);
    allDocs.push(...docs);
  }

  return allDocs;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return getCategories().find((cat) => cat.slug === slug);
}
