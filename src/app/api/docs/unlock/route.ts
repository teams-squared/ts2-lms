import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocContent } from "@/lib/docs";
import bcrypt from "bcryptjs";

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

  const doc = await getDocContent(category, slug);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
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

  // Set an httpOnly session cookie (no maxAge = session cookie, cleared on browser close)
  const cookieName = `doc-unlock-${category}-${slug}`;
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // No maxAge / expires = session cookie
  });

  return response;
}
