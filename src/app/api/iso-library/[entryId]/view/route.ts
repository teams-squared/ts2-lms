import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/iso-library/[entryId]/view
 *
 * Fire-and-forget audit log for a library doc open. Captures the current
 * sourceVersion at view time so we can later prove which version the user
 * actually opened. Not used as ack evidence — that path goes through
 * LessonProgress in the course flow.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { entryId } = await params;

  const entry = await prisma.isoLibraryEntry.findUnique({
    where: { id: entryId },
    select: { id: true, policyDocLesson: { select: { sourceVersion: true } } },
  });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await prisma.isoLibraryView.create({
    data: {
      entryId,
      userId: auth.userId,
      sourceVersion: entry.policyDocLesson.sourceVersion,
    },
  });

  return NextResponse.json({ ok: true });
}
