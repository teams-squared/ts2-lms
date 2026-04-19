import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

type Params = { params: Promise<{ userId: string }> };

/** GET /api/admin/users/[userId]/clearances — list user's clearances. */
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;

  const clearances = await prisma.userClearance.findMany({
    where: { userId },
    orderBy: { grantedAt: "asc" },
  });

  return NextResponse.json(clearances);
}

/** POST /api/admin/users/[userId]/clearances — grant a clearance. */
export async function POST(request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { userId } = await params;
  const body = await request.json();
  const clearance = (body.clearance as string)?.trim().toLowerCase();

  if (!clearance) {
    return NextResponse.json(
      { error: "clearance is required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const record = await prisma.userClearance.upsert({
    where: { userId_clearance: { userId, clearance } },
    create: { userId, clearance },
    update: {},
  });

  return NextResponse.json(record, { status: 201 });
}
