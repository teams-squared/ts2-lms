/**
 * Local filesystem content provider.
 *
 * Used automatically when SharePoint credentials are absent (local dev).
 * Content is read from `local-content/` in the project root — that directory
 * is gitignored so it never gets committed. Copy `local-content.example/` to
 * `local-content/` to get started:
 *
 *   cp -r local-content.example local-content   # macOS/Linux
 *   xcopy local-content.example local-content /e /i   # Windows
 *
 * Directory layout mirrors the SharePoint structure:
 *
 *   local-content/
 *     _categories.json       ← category definitions
 *     [category-slug]/
 *       [doc-slug].mdx       ← one file per document
 */

import { readFile, readdir } from "fs/promises";
import path from "path";
import type { Category } from "./types";

const LOCAL_CONTENT_DIR = path.join(process.cwd(), "local-content");

export async function fetchCategoriesFromLocal(): Promise<Category[]> {
  try {
    const raw = await readFile(
      path.join(LOCAL_CONTENT_DIR, "_categories.json"),
      "utf-8"
    );
    return JSON.parse(raw) as Category[];
  } catch {
    return [];
  }
}

export async function fetchDocListFromLocal(
  categorySlug: string
): Promise<string[]> {
  try {
    const files = await readdir(path.join(LOCAL_CONTENT_DIR, categorySlug));
    return files.filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
}

export async function fetchDocContentFromLocal(
  categorySlug: string,
  fileName: string
): Promise<string> {
  const filePath = path.join(LOCAL_CONTENT_DIR, categorySlug, fileName);
  return readFile(filePath, "utf-8");
}
