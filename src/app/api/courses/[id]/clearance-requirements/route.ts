import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/courses/[id]/clearance-requirements — add or update a sector+tier
 * requirement on a course. Body: { sectorId, tier }. One requirement per
 * sector (re-adding the same sector updates the tier).
 */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: courseId } = await params;
  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const sectorId = (body.sectorId as string)?.trim();
  const tier = Number(body.tier);
  if (!sectorId) {
    return NextResponse.json({ error: "sectorId is required" }, { status: 400 });
  }
  if (!Number.isInteger(tier) || tier < 0) {
    return NextResponse.json(
      { error: "tier must be a non-negative integer" },
      { status: 400 },
    );
  }

  const sector = await prisma.sector.findUnique({
    where: { id: sectorId },
    select: { id: true, label: true },
  });
  if (!sector) {
    return NextResponse.json({ error: "Sector not found" }, { status: 404 });
  }

  const existing = await prisma.resourceClearanceRequirement.findFirst({
    where: { courseId, sectorId },
    select: { id: true },
  });
  const row = existing
    ? await prisma.resourceClearanceRequirement.update({
        where: { id: existing.id },
        data: { tier },
      })
    : await prisma.resourceClearanceRequirement.create({
        data: { courseId, sectorId, tier },
      });

  return NextResponse.json(
    { sectorId: row.sectorId, sectorLabel: sector.label, tier: row.tier },
    { status: 201 },
  );
}

/**
 * DELETE /api/courses/[id]/clearance-requirements?sectorId=... — remove a
 * course's requirement for a sector.
 */
export async function DELETE(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: courseId } = await params;
  if (!(await canManageCourse(session.user.id, session.user.role as Role, courseId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sectorId = new URL(request.url).searchParams.get("sectorId")?.trim();
  if (!sectorId) {
    return NextResponse.json({ error: "sectorId is required" }, { status: 400 });
  }

  await prisma.resourceClearanceRequirement.deleteMany({
    where: { courseId, sectorId },
  });

  return NextResponse.json({ deleted: true });
}
