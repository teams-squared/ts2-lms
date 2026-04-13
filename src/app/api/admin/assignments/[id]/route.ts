import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/admin/assignments/[id] — remove an assignment (admin/manager only) */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isPrivileged =
    session.user.role === "admin" || session.user.role === "manager";
  if (!isPrivileged) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  await prisma.assignment.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
