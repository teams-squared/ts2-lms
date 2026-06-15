import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ userId: string }> };

/** GET /api/admin/users/[userId]/clearances — list the user's sector grants. */
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;

  const clearances = await prisma.userClearance.findMany({
    where: { userId },
    orderBy: { grantedAt: "asc" },
    select: {
      sectorId: true,
      tier: true,
      grantedAt: true,
      sector: { select: { key: true, label: true } },
    },
  });

  return NextResponse.json(clearances);
}

/**
 * POST /api/admin/users/[userId]/clearances — grant (or update) a sector
 * clearance. Body: { sectorId, tier }. A user holds at most one tier per
 * sector, so re-granting the same sector updates the tier (upsert).
 */
export async function POST(request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;
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

  const [user, sector] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.sector.findUnique({ where: { id: sectorId }, select: { id: true } }),
  ]);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!sector) {
    return NextResponse.json({ error: "Sector not found" }, { status: 404 });
  }

  const record = await prisma.userClearance.upsert({
    where: { userId_sectorId: { userId, sectorId } },
    create: { userId, sectorId, tier },
    update: { tier },
    select: {
      sectorId: true,
      tier: true,
      grantedAt: true,
      sector: { select: { key: true, label: true } },
    },
  });

  await writeAuditLog({
    action: "clearance.granted",
    actorId: authResult.userId,
    actorEmail: authResult.session?.user?.email,
    targetType: "user",
    targetId: userId,
    metadata: { sectorId, sectorKey: record.sector.key, tier },
  });

  return NextResponse.json(record, { status: 201 });
}
