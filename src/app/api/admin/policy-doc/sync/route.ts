import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { syncPolicyDoc } from "@/lib/policy-doc/sync";

const Body = z.object({
  lessonId: z.string().min(1),
  driveId: z.string().min(1),
  itemId: z.string().min(1),
});

/**
 * POST /api/admin/policy-doc/sync
 *
 * Bind (or re-sync) a POLICY_DOC lesson to a SharePoint document. Pulls the
 * file, parses it, persists snapshot + rendered HTML. If the source version
 * has changed since the last sync, all existing learner acknowledgements
 * for this lesson are invalidated (forces re-acknowledge of new version).
 *
 * Course managers and above. Same authorization tier as creating/updating
 * any other lesson body.
 */
export async function POST(request: Request) {
  const auth = await requireRole("course_manager");
  if (auth instanceof NextResponse) return auth;

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { lessonId, driveId, itemId } = parsed.data;

  // Verify the lesson exists and is the right type before we burn a Graph
  // call on it.
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, type: true },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (lesson.type !== "POLICY_DOC") {
    return NextResponse.json(
      { error: "Lesson is not a policy_doc type" },
      { status: 400 },
    );
  }

  try {
    const outcome = await syncPolicyDoc({
      lessonId,
      driveId,
      itemId,
      actorUserId: auth.userId,
    });
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("[policy-doc] sync failed:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
