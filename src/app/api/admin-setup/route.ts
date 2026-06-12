import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-time bootstrap endpoint to promote the FIRST user to ADMIN.
 * Requires the ADMIN_SETUP_SECRET env var to be set, supplied in the
 * `x-admin-setup-secret` header (NOT a query param — query strings land in
 * access logs / browser history). Self-disables permanently once any ADMIN
 * exists, so it cannot be replayed to escalate additional accounts.
 *
 * Usage: GET /api/admin-setup?email=<email>  -H "x-admin-setup-secret: <secret>"
 */
export async function GET(request: Request) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const provided = request.headers.get("x-admin-setup-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // One-time guard: the endpoint exists only to mint the first admin. Once one
  // exists it is permanently inert, even if the secret leaks.
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) {
    return NextResponse.json(
      { error: "An admin already exists; this endpoint is disabled." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
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
