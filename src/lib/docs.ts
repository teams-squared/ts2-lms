import matter from "gray-matter";
import type { Category, DocMeta, Role } from "./types";
import { hasAccess } from "./roles";
import {
  fetchCategoriesFromSharePoint,
  fetchDocListFromSharePoint,
  fetchDocContentFromSharePoint,
} from "./sharepoint";

function buildDocMeta(
  data: Record<string, unknown>,
  slug: string,
  categorySlug: string
): DocMeta {
  return {
    title: (data.title as string) || slug,
    description: (data.description as string) || "",
    slug,
    category: categorySlug,
    minRole: (data.minRole as Role) || "employee",
    updatedAt: (data.updatedAt as string) || "",
    author: data.author as string | undefined,
    tags: (data.tags as string[]) || [],
    order: (data.order as number) || 0,
  };
}

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
    files.map(async (name) => {
      const raw = await fetchDocContentFromSharePoint(categorySlug, name);
      const { data } = matter(raw);
      const slug = name.replace(".mdx", "");
      return buildDocMeta(data, slug, categorySlug);
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
  const fileName = `${slug}.mdx`;
  if (!files.includes(fileName)) return null;

  const raw = await fetchDocContentFromSharePoint(category, fileName);
  const { data, content } = matter(raw);

  return { meta: buildDocMeta(data, slug, category), content };
}

export async function getAllDocs(userRole?: Role): Promise<DocMeta[]> {
  const categories = userRole
    ? await getAccessibleCategories(userRole)
    : await getCategories();
  const results = await Promise.all(
    categories.map((cat) => getDocsByCategory(cat.slug, userRole))
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
