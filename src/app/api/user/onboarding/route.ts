import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/user/onboarding — mark the current user's first-login onboarding
 * as seen. Idempotent: only stamps `onboardedAt` the first time (a no-op once
 * set), so re-runs never move the original timestamp.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.updateMany({
    where: { id: session.user.id, onboardedAt: null },
    data: { onboardedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
