import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { hasAccess } from "@/lib/roles";
import { fetchDocContentFromSharePoint, writeDocContentToSharePoint } from "@/lib/sharepoint";
import { fetchDocListFromSharePoint } from "@/lib/sharepoint";
import type { Role } from "@/lib/types";

export async function POST(req: NextRequest) {
  // Must be manager or admin
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userRole = (session.user.role as Role) || "employee";
  if (!hasAccess(userRole, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { category?: string; slug?: string; password?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { category, slug, password } = body;
  if (!category || !slug) {
    return NextResponse.json(
      { error: "category and slug are required" },
      { status: 400 }
    );
  }

  // Validate inputs to prevent path traversal
  const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
  if (!SAFE_SEGMENT.test(category) || !SAFE_SEGMENT.test(slug)) {
    return NextResponse.json({ error: "Invalid category or slug" }, { status: 400 });
  }

  // Verify the document exists
  const fileName = `${slug}.mdx`;

  let files: string[];
  try {
    files = await fetchDocListFromSharePoint(category);
  } catch (err) {
    console.error("[protect] failed to list SharePoint docs:", err);
    return NextResponse.json(
      { error: "Could not reach SharePoint. Check server logs." },
      { status: 502 }
    );
  }

  if (!files.includes(fileName)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let raw: string;
  try {
    raw = await fetchDocContentFromSharePoint(category, fileName);
  } catch (err) {
    console.error("[protect] failed to fetch doc content:", err);
    return NextResponse.json(
      { error: "Could not read document from SharePoint. Check server logs." },
      { status: 502 }
    );
  }

  // Parse frontmatter and body separately
  const parsed = matter(raw);

  if (password && password.trim().length > 0) {
    // Set or replace password protection
    const hash = await bcrypt.hash(password.trim(), 10);
    parsed.data.password = hash;
  } else {
    // Remove password protection
    delete parsed.data.password;
  }

  // Re-serialise: matter.stringify(content, frontmatter)
  const updated = matter.stringify(parsed.content, parsed.data);

  // Write back to SharePoint (clears the full in-memory cache)
  try {
    await writeDocContentToSharePoint(category, fileName, updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[protect] failed to write doc to SharePoint:", message);
    return NextResponse.json(
      { error: "Failed to save document. Check server logs." },
      { status: 502 }
    );
  }

  // Tell Next.js to purge any server-side cached RSC payload for this page
  // so the next render always re-runs the server component with fresh data.
  revalidatePath(`/docs/${category}/${slug}`);

  return NextResponse.json({ success: true });
}
