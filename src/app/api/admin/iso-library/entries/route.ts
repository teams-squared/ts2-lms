import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/iso-library/entries
 *
 * Curated ISO library entries for the admin UI. Joins through to the
 * underlying PolicyDocLesson + Lesson + Module + Course so the manager can
 * see where each doc lives in the training tree.
 */
export async function GET() {
  const auth = await requireRole("course_manager");
  if (auth instanceof NextResponse) return auth;

  const entries = await prisma.isoLibraryEntry.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      policyDocLesson: {
        select: {
          id: true,
          documentTitle: true,
          documentCode: true,
          sourceVersion: true,
          lastReviewedOn: true,
          lesson: {
            select: {
              id: true,
              title: true,
              module: {
                select: {
                  id: true,
                  title: true,
                  course: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
      },
      addedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ entries });
}

const PostBody = z.object({
  policyDocLessonIds: z.array(z.string().min(1)).min(1),
});

/**
 * POST /api/admin/iso-library/entries
 *
 * Add one or more PolicyDocLessons to the library. Idempotent: duplicates
 * are silently skipped via the unique constraint. New rows are appended at
 * the bottom of the sort order.
 */
export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const json = await request.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const last = await prisma.isoLibraryEntry.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextOrder = (last?.sortOrder ?? -1) + 1;

  const created: string[] = [];
  for (const policyDocLessonId of parsed.data.policyDocLessonIds) {
    try {
      const row = await prisma.isoLibraryEntry.create({
        data: {
          policyDocLessonId,
          sortOrder: nextOrder,
          addedById: auth.userId,
        },
        select: { id: true },
      });
      created.push(row.id);
      nextOrder += 1;
    } catch (err) {
      // Unique violation (already in library) — skip silently. Anything
      // else surfaces as 500 to the caller.
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json({ createdIds: created });
}
