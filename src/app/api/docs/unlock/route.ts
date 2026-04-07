import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocContent } from "@/lib/docs";
import { hasAccess } from "@/lib/roles";
import { encode, getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import type { Role } from "@/lib/types";

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

/**
 * The name of the NextAuth session cookie, which differs between
 * development (plain HTTP) and production (HTTPS with __Secure- prefix).
 */
function sessionCookieName(secure: boolean) {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function POST(req: NextRequest) {
  // Must be authenticated
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { category?: string; slug?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { category, slug, password } = body;
  if (!category || !slug || !password) {
    return NextResponse.json(
      { error: "category, slug, and password are required" },
      { status: 400 }
    );
  }

  // Validate inputs to prevent path traversal
  if (!SAFE_SEGMENT.test(category) || !SAFE_SEGMENT.test(slug)) {
    return NextResponse.json({ error: "Invalid category or slug" }, { status: 400 });
  }

  const doc = await getDocContent(category, slug);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Enforce role-based access — users must meet the document's minRole
  const userRole = (session.user.role as Role) || "employee";
  if (!hasAccess(userRole, doc.meta.minRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!doc.passwordHash) {
    return NextResponse.json(
      { error: "Document is not password protected" },
      { status: 400 }
    );
  }

  const correct = await bcrypt.compare(password, doc.passwordHash);
  if (!correct) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // ── Grant access by writing the doc key into the session JWT ─────────────
  //
  // Storing the unlock inside the auth JWT means the grant is automatically
  // revoked when the user signs out (the JWT cookie is deleted), without any
  // separate cookie management or session-value matching.
  //
  // The JWT is JWE-encrypted (A256CBC-HS512), so we must use the same
  // encode/getToken helpers that NextAuth uses internally.

  const isSecure = process.env.NODE_ENV === "production";
  const cookieName = sessionCookieName(isSecure);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

  // Read the current JWT from the incoming request cookie
  const currentToken = await getToken({ req, secret, secureCookie: isSecure });
  if (!currentToken) {
    return NextResponse.json({ error: "Failed to read session" }, { status: 500 });
  }

  const docKey = `${category}/${slug}`;
  const alreadyUnlocked =
    (currentToken.unlockedDocs as string[] | undefined)?.includes(docKey) ?? false;

  if (alreadyUnlocked) {
    // Nothing to update — tell the client so it can refresh
    return NextResponse.json({ success: true });
  }

  const currentUnlocked =
    (currentToken.unlockedDocs as string[] | undefined) ?? [];

  const updatedToken = {
    ...currentToken,
    unlockedDocs: [...currentUnlocked, docKey],
  };

  // Preserve the session's original expiry so we don't accidentally extend it
  const remainingTtl =
    typeof currentToken.exp === "number"
      ? currentToken.exp - Math.floor(Date.now() / 1000)
      : 30 * 24 * 60 * 60; // 30 days fallback

  const newJwt = await encode({
    token: updatedToken,
    secret,
    salt: cookieName,
    maxAge: Math.max(remainingTtl, 60), // at least 60 s
  });

  const response = NextResponse.json({ success: true });

  // Overwrite the session cookie with the updated JWT.
  // Options must match what NextAuth uses (see @auth/core/lib/utils/cookie.js):
  //   httpOnly: true, sameSite: "lax", path: "/"
  response.cookies.set(cookieName, newJwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: Math.max(remainingTtl, 60),
  });

  return response;
}
