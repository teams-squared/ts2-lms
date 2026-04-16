import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/admin/assignments/[id] — remove an assignment (admin/manager only) */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("manager");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  await prisma.assignment.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
