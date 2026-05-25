import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/iso-library/available
 *
 * PolicyDocLessons that are NOT yet in the library — fed to the picker
 * modal so the admin can only add docs that aren't already curated.
 */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const candidates = await prisma.policyDocLesson.findMany({
    where: { libraryEntry: null },
    orderBy: [{ documentCode: "asc" }, { documentTitle: "asc" }],
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
  });

  return NextResponse.json({ candidates });
}
