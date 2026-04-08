import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import matter from "gray-matter";
import { auth } from "@/lib/auth";
import {
  fetchDocContentFromSharePoint,
  writeDocContentToSharePoint,
  moveDocInSharePoint,
} from "@/lib/sharepoint";

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

// ─── PATCH /api/admin/docs/move ──────────────────────────────────────────────
// Two modes:
//   • Same doc (same category + slug), order provided → reorder within category
//   • Different category → move document to new category folder

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    fromCategory?: string;
    fromSlug?: string;
    toCategory?: string;
    toSlug?: string;
    order?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { fromCategory, fromSlug, toCategory, toSlug, order } = body;

  if (!fromCategory || !fromSlug || !toCategory || !toSlug) {
    return NextResponse.json(
      { error: "fromCategory, fromSlug, toCategory, and toSlug are required" },
      { status: 400 }
    );
  }

  for (const seg of [fromCategory, fromSlug, toCategory, toSlug]) {
    if (!SAFE_SEGMENT.test(seg)) {
      return NextResponse.json({ error: `Invalid path segment: ${seg}` }, { status: 400 });
    }
  }

  const isSameDoc = fromCategory === toCategory && fromSlug === toSlug;

  try {
    if (isSameDoc && order !== undefined) {
      // Reorder: update the `order` field in frontmatter and write back
      const raw = await fetchDocContentFromSharePoint(fromCategory, `${fromSlug}.mdx`);
      const parsed = matter(raw);
      parsed.data.order = order;
      const updated = matter.stringify(parsed.content, parsed.data);
      await writeDocContentToSharePoint(fromCategory, `${fromSlug}.mdx`, updated);
    } else {
      // Move to a different category (and optionally rename slug)
      await moveDocInSharePoint(
        fromCategory,
        `${fromSlug}.mdx`,
        toCategory,
        `${toSlug}.mdx`
      );
    }
  } catch (err) {
    console.error("[admin/docs/move] Operation failed:", err);
    return NextResponse.json({ error: "Operation failed — check server logs" }, { status: 502 });
  }

  revalidatePath(`/docs/${fromCategory}`);
  if (toCategory !== fromCategory) revalidatePath(`/docs/${toCategory}`);
  revalidatePath("/docs");

  return NextResponse.json({ ok: true });
}
