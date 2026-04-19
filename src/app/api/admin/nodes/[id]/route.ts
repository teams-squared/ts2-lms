import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

/** PATCH /api/admin/nodes/[id] — update a node */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  let body: { name?: string; description?: string; parentId?: string | null; order?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = await prisma.courseNode.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  // Prevent setting parent to self or own descendant
  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === id) {
      return NextResponse.json({ error: "A node cannot be its own parent" }, { status: 400 });
    }
    // Check the parent exists
    const parent = await prisma.courseNode.findUnique({ where: { id: body.parentId } });
    if (!parent) {
      return NextResponse.json({ error: "Parent node not found" }, { status: 404 });
    }
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.parentId !== undefined) data.parentId = body.parentId;
  if (body.order !== undefined) data.order = body.order;

  const updated = await prisma.courseNode.update({ where: { id }, data });
  return NextResponse.json(updated);
}

/** DELETE /api/admin/nodes/[id] — delete a node, reparent children, unassign courses */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const existing = await prisma.courseNode.findUnique({
    where: { id },
    include: { children: { select: { id: true } }, courses: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  await prisma.$transaction([
    // Reparent children to the deleted node's parent
    prisma.courseNode.updateMany({
      where: { parentId: id },
      data: { parentId: existing.parentId },
    }),
    // Unassign courses from this node
    prisma.course.updateMany({
      where: { nodeId: id },
      data: { nodeId: null },
    }),
    // Delete the node
    prisma.courseNode.delete({ where: { id } }),
  ]);

  return NextResponse.json({ deleted: true });
}
