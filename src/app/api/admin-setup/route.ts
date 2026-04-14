import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-time bootstrap endpoint to promote a user to ADMIN.
 * Requires the ADMIN_SETUP_SECRET env var to be set.
 * Delete or unset ADMIN_SETUP_SECRET after use.
 *
 * Usage: GET /api/admin-setup?secret=<ADMIN_SETUP_SECRET>&email=<email>
 */
export async function GET(request: Request) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email param required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });

  return NextResponse.json({ ok: true, promoted: email });
}
