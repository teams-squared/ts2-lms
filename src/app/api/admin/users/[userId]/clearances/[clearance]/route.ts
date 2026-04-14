import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ userId: string; clearance: string }> };

/** DELETE /api/admin/users/[userId]/clearances/[clearance] — revoke a clearance. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
