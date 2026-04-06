import { NextRequest, NextResponse } from "next/server";
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

  // Verify the document exists
  const fileName = `${slug}.mdx`;
  const files = await fetchDocListFromSharePoint(category);
  if (!files.includes(fileName)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Fetch current raw MDX content
  const raw = await fetchDocContentFromSharePoint(category, fileName);

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

  // Write back to SharePoint (also clears cache entries for this doc)
  await writeDocContentToSharePoint(category, fileName, updated);

  return NextResponse.json({ success: true });
}
