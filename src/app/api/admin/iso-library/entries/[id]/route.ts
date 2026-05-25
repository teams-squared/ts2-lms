import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/iso-library/entries/[id]
 *
 * Remove an entry from the library. Does NOT delete the underlying
 * PolicyDocLesson — that lives in a course and is managed separately.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    await prisma.isoLibraryEntry.delete({ where: { id } });
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
