import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

type Params = { params: Promise<{ userId: string; clearance: string }> };

/** DELETE /api/admin/users/[userId]/clearances/[clearance] — revoke a clearance. */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId, clearance } = await params;

  const existing = await prisma.userClearance.findUnique({
    where: { userId_clearance: { userId, clearance } },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Clearance not found" },
      { status: 404 },
    );
  }

  await prisma.userClearance.delete({
    where: { userId_clearance: { userId, clearance } },
  });

  return NextResponse.json({ deleted: true });
}
