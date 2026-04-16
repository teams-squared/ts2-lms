import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { getNodeTree } from "@/lib/courseNodes";

/** GET /api/admin/nodes — full node tree with course counts */
export async function GET() {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const tree = await getNodeTree();
  return NextResponse.json(tree);
}

/** POST /api/admin/nodes — create a node */
export async function POST(request: Request) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  let body: { name?: string; parentId?: string | null; description?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, parentId, description } = body;
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // If parentId provided, verify it exists
  if (parentId) {
    const parent = await prisma.courseNode.findUnique({ where: { id: parentId } });
    if (!parent) {
      return NextResponse.json({ error: "Parent node not found" }, { status: 404 });
    }
  }

  // Determine order: place at end of siblings
  const maxOrder = await prisma.courseNode.aggregate({
    where: { parentId: parentId ?? null },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const node = await prisma.courseNode.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      parentId: parentId ?? null,
      order: nextOrder,
    },
  });

  return NextResponse.json(node, { status: 201 });
}
