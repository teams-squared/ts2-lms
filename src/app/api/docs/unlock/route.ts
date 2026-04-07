import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocContent } from "@/lib/docs";
import { hasAccess } from "@/lib/roles";
import bcrypt from "bcryptjs";
import type { Role } from "@/lib/types";

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

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

  // Bind the unlock cookie to the current login session.
  // loginId is a UUID generated fresh on every sign-in (see auth.ts JWT callback).
  // If the user signs out and back in, a new loginId is issued, making this cookie
  // invalid even if it persists in the browser as a session cookie.
  const loginId = session.user.loginId;
  if (!loginId) {
    // Should never happen for a valid session, but be defensive.
    return NextResponse.json({ error: "Invalid session" }, { status: 403 });
  }

  const cookieName = `doc-unlock-${category}-${slug}`;
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName, loginId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: `/docs/${category}/${slug}`,
  });

  return response;
}
