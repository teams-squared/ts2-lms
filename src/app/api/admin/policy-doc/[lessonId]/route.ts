import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ lessonId: string }> };

/**
 * GET /api/admin/policy-doc/[lessonId] — return the current PolicyDocLesson
 * row (snapshot metadata) for an admin-side lesson editor. 404 if the lesson
 * is POLICY_DOC but hasn't been bound to a SharePoint doc yet.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireRole("course_manager");
  if (auth instanceof NextResponse) return auth;

  const { lessonId } = await params;

  const row = await prisma.policyDocLesson.findUnique({
    where: { lessonId },
    select: {
      id: true,
      sharePointDriveId: true,
      sharePointItemId: true,
      sharePointWebUrl: true,
      documentTitle: true,
      documentCode: true,
      sourceVersion: true,
      sourceETag: true,
      sourceLastModified: true,
      approver: true,
      approvedOn: true,
      lastReviewedOn: true,
      renderMode: true,
      renderedHTMLHash: true,
      lastSyncedAt: true,
      lastSyncedBy: { select: { name: true, email: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ bound: false }, { status: 200 });
  }

  return NextResponse.json({ bound: true, policyDoc: row });
}
