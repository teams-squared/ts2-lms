import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

type Params = { params: Promise<{ userId: string; sectorId: string }> };

/** DELETE /api/admin/users/[userId]/clearances/[sectorId] — revoke a sector grant. */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId, sectorId } = await params;

  const existing = await prisma.userClearance.findUnique({
    where: { userId_sectorId: { userId, sectorId } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Clearance not found" }, { status: 404 });
  }

  await prisma.userClearance.delete({
    where: { userId_sectorId: { userId, sectorId } },
  });

  return NextResponse.json({ deleted: true });
}
