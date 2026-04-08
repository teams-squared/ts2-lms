import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import { auth } from "@/lib/auth";
import {
  ensureCategoryFolder,
  writeDocContentToSharePoint,
  deleteDocFromSharePoint,
} from "@/lib/sharepoint";

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

// ─── POST /api/admin/docs — upload a new .mdx document ───────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string | null;

  if (!file || !category) {
    return NextResponse.json({ error: "Missing file or category" }, { status: 400 });
  }
  if (!file.name.endsWith(".mdx")) {
    return NextResponse.json({ error: "File must have a .mdx extension" }, { status: 400 });
  }

  const slug = file.name.slice(0, -4); // strip .mdx
  if (!SAFE_SEGMENT.test(slug) || !SAFE_SEGMENT.test(category)) {
    return NextResponse.json({ error: "Invalid filename or category" }, { status: 400 });
  }

  const content = await file.text();

  // Validate frontmatter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch {
    return NextResponse.json({ error: "Frontmatter could not be parsed" }, { status: 400 });
  }
  if (!parsed.data.title || !parsed.data.description) {
    return NextResponse.json(
      { error: "Frontmatter must include 'title' and 'description'" },
      { status: 400 }
    );
  }

  try {
    await ensureCategoryFolder(category);
    await writeDocContentToSharePoint(category, file.name, content);
  } catch (err) {
    console.error("[admin/docs] Upload failed:", err);
    return NextResponse.json({ error: "Upload failed — check server logs" }, { status: 502 });
  }

  revalidatePath("/admin/content");
  revalidatePath(`/docs/${category}`);
  revalidatePath("/docs");
  revalidatePath("/");
  return NextResponse.json({ slug, category }, { status: 201 });
}

// ─── DELETE /api/admin/docs — permanently delete a document ──────────────────

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { category?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { category, slug } = body;
  if (!category || !slug) {
    return NextResponse.json({ error: "category and slug are required" }, { status: 400 });
  }
  if (!SAFE_SEGMENT.test(category) || !SAFE_SEGMENT.test(slug)) {
    return NextResponse.json({ error: "Invalid category or slug" }, { status: 400 });
  }

  try {
    await deleteDocFromSharePoint(category, `${slug}.mdx`);
  } catch (err) {
    console.error("[admin/docs] Delete failed:", err);
    return NextResponse.json({ error: "Delete failed — check server logs" }, { status: 502 });
  }

  revalidatePath("/admin/content");
  revalidatePath(`/docs/${category}`);
  revalidatePath("/docs");
  revalidatePath("/");
  return new NextResponse(null, { status: 204 });
}
