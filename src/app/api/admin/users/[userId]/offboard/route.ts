/**
 * Offboard / reactivate a user (soft state).
 *
 * Unlike the sibling DELETE handler which hard-deletes the row and all its
 * history, offboarding is a reversible soft state: `offboardedAt` is set to
 * the current timestamp, and the row — enrollments, progress, audit trail —
 * is preserved. Reactivation (DELETE on this route) clears `offboardedAt`
 * and restores full access.
 *
 * POST   /api/admin/users/[userId]/offboard  → offboard (set offboardedAt)
 * DELETE /api/admin/users/[userId]/offboard  → reactivate (clear offboardedAt)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ userId: string }> };

/** POST /api/admin/users/[userId]/offboard — soft-offboard a user. */
export async function POST(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: adminId } = authResult;

  const { userId } = await params;

  if (userId === adminId) {
    return NextResponse.json(
      { error: "You cannot offboard your own account" },
      { status: 409 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, offboardedAt: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot offboard the last admin" },
        { status: 409 },
      );
    }
  }

  if (target.offboardedAt != null) {
    return NextResponse.json(
      { error: "User is already offboarded" },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { offboardedAt: new Date() },
    });
    await writeAuditLog(
      {
        action: "user.offboarded",
        actorId: adminId,
        actorEmail: authResult.session?.user?.email,
        targetType: "user",
        targetId: userId,
        metadata: {
          targetEmail: target.email,
          targetRole: target.role,
          source: "manual",
        },
      },
      tx,
    );
  });

  return NextResponse.json({ offboarded: true });
}

/** DELETE /api/admin/users/[userId]/offboard — reactivate an offboarded user. */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: adminId } = authResult;

  const { userId } = await params;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, offboardedAt: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.offboardedAt == null) {
    return NextResponse.json(
      { error: "User is not offboarded" },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { offboardedAt: null },
    });
    await writeAuditLog(
      {
        action: "user.reactivated",
        actorId: adminId,
        actorEmail: authResult.session?.user?.email,
        targetType: "user",
        targetId: userId,
        metadata: {
          targetEmail: target.email,
          targetRole: target.role,
        },
      },
      tx,
    );
  });

  return NextResponse.json({ reactivated: true });
}
