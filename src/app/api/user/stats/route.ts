import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLevel } from "@/lib/levels";

/** GET /api/user/stats — returns the current user's XP, streak, and level info. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await prisma.userStats.findUnique({
    where: { userId: session.user.id },
  });

  const xp = stats?.xp ?? 0;
  const streak = stats?.streak ?? 0;
  const levelInfo = calculateLevel(xp);

  return NextResponse.json({
    xp,
    streak,
    ...levelInfo,
    lastActivityDate: stats?.lastActivityDate?.toISOString() ?? null,
  });
}
