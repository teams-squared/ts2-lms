import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/iso-library
 *
 * Curated ISO docs for any logged-in user. Returns only the metadata the
 * /iso-docs list page needs — full doc body comes from the per-entry view
 * page.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const entries = await prisma.isoLibraryEntry.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      policyDocLesson: {
        select: {
          documentTitle: true,
          documentCode: true,
          sourceVersion: true,
          approver: true,
          approvedOn: true,
          lastReviewedOn: true,
          sharePointWebUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ entries });
}
