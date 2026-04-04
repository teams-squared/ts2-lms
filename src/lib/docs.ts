import matter from "gray-matter";
import type { Category, DocMeta, Role } from "./types";
import { hasAccess } from "./roles";
import {
  fetchCategoriesFromSharePoint,
  fetchDocListFromSharePoint,
  fetchDocContentFromSharePoint,
} from "./sharepoint";

export async function getCategories(): Promise<Category[]> {
  return fetchCategoriesFromSharePoint();
}

export async function getAccessibleCategories(
  userRole: Role
): Promise<Category[]> {
  const categories = await getCategories();
  return categories.filter((cat) => hasAccess(userRole, cat.minRole));
}

export async function getDocsByCategory(
  categorySlug: string,
  userRole?: Role
): Promise<DocMeta[]> {
  const files = await fetchDocListFromSharePoint(categorySlug);
  if (files.length === 0) return [];

  const docs: DocMeta[] = await Promise.all(
    files.map(async ({ name, downloadUrl }) => {
      const raw = await fetchDocContentFromSharePoint(downloadUrl);
      const { data } = matter(raw);
      const slug = name.replace(".mdx", "");
      return {
        title: data.title || slug,
        description: data.description || "",
        slug,
        category: categorySlug,
        minRole: data.minRole || "employee",
        updatedAt: data.updatedAt || "",
        author: data.author,
        tags: data.tags || [],
        order: data.order || 0,
      } satisfies DocMeta;
    })
  );

  const filtered = userRole
    ? docs.filter((doc) => hasAccess(userRole, doc.minRole))
    : docs;

  return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getDocContent(
  category: string,
  slug: string
): Promise<{ meta: DocMeta; content: string } | null> {
  const files = await fetchDocListFromSharePoint(category);
  const file = files.find((f) => f.name === `${slug}.mdx`);
  if (!file) return null;

  const raw = await fetchDocContentFromSharePoint(file.downloadUrl);
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

export async function getAllDocs(): Promise<DocMeta[]> {
  const categories = await getCategories();
  const results = await Promise.all(
    categories.map((cat) => getDocsByCategory(cat.slug))
  );
  return results.flat();
}

export async function getCategoryBySlug(
  slug: string
): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((cat) => cat.slug === slug);
}

export async function getTopLevelCategories(
  userRole: Role
): Promise<Category[]> {
  const categories = await getAccessibleCategories(userRole);
  return categories.filter((cat) => !cat.parentCategory);
}

export async function getSubcategoriesOf(
  parentSlug: string,
  userRole: Role
): Promise<Category[]> {
  const categories = await getAccessibleCategories(userRole);
  return categories.filter((cat) => cat.parentCategory === parentSlug);
}
