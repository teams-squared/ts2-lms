/**
 * Local filesystem content provider.
 *
 * Used automatically when SharePoint credentials are absent (local dev).
 * Content is read from `local-content/` in the project root. The directory
 * is committed to dev branches for testing; in production it is ignored
 * because SharePoint is configured and isSharePointConfigured() returns true.
 *
 * Directory layout mirrors the SharePoint structure:
 *
 *   local-content/
 *     _categories.json       ← category definitions
 *     _roles.json            ← demo user role overrides
 *     [category-slug]/
 *       [doc-slug].mdx       ← one file per document
 */

import { readFile, readdir } from "fs/promises";
import path from "path";
import type { Category } from "./types";

const LOCAL_CONTENT_DIR = path.join(process.cwd(), "local-content");

/** Allow only safe path segments — letters, digits, hyphens, underscores. */
function isSafeSegment(segment: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(segment);
}

export async function fetchCategoriesFromLocal(): Promise<Category[]> {
  try {
    const raw = await readFile(
      path.join(LOCAL_CONTENT_DIR, "_categories.json"),
      "utf-8"
    );
    return JSON.parse(raw) as Category[];
  } catch (err) {
    console.error("[local-content] Failed to load _categories.json:", err);
    return [];
  }
}

export async function fetchDocListFromLocal(
  categorySlug: string
): Promise<string[]> {
  if (!isSafeSegment(categorySlug)) return [];
  try {
    const files = await readdir(path.join(LOCAL_CONTENT_DIR, categorySlug));
    return files.filter((f) => f.endsWith(".mdx"));
  } catch (err) {
    // ENOENT = category directory doesn't exist (normal); other errors are unexpected
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.error(`[local-content] Failed to list docs for "${categorySlug}":`, err);
    }
    return [];
  }
}

export async function fetchDocContentFromLocal(
  categorySlug: string,
  fileName: string
): Promise<string> {
  const baseName = path.basename(fileName); // strip any directory component
  if (!isSafeSegment(categorySlug) || !baseName.endsWith(".mdx") || !isSafeSegment(baseName.replace(".mdx", ""))) {
    return "";
  }
  const filePath = path.join(LOCAL_CONTENT_DIR, categorySlug, baseName);
  try {
    return await readFile(filePath, "utf-8");
  } catch (err) {
    console.error(`[local-content] Failed to read "${filePath}":`, err);
    return "";
  }
}
