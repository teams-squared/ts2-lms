import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** POST /api/courses/[id]/modules/reorder — reorder modules for a course. */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;

  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { orderedIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });
  }

  const existing = await prisma.module.findMany({
    where: { courseId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((m) => m.id));

  if (
    body.orderedIds.length !== existingIds.size ||
    body.orderedIds.some((id) => !existingIds.has(id))
  ) {
    return NextResponse.json(
      { error: "orderedIds must match existing module IDs exactly" },
      { status: 400 },
    );
  }

  // Two-phase update to avoid the unique (courseId, order) constraint:
  // first move every module to a temp order range, then to its final order.
  await prisma.$transaction([
    ...body.orderedIds.map((id, idx) =>
      prisma.module.update({
        where: { id },
        data: { order: -(idx + 1) },
      }),
    ),
    ...body.orderedIds.map((id, idx) =>
      prisma.module.update({
        where: { id },
        data: { order: idx + 1 },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true });
}
