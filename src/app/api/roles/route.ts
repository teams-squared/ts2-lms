import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAllElevatedUsers,
  setUserRole,
  removeUserRole,
} from "@/lib/role-store";
import type { Role } from "@/lib/types";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAllElevatedUsers();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; role?: Role };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, role } = body;

  if (!email || !role || !["admin", "manager", "employee"].includes(role)) {
    return NextResponse.json(
      { error: "Invalid email or role" },
      { status: 400 }
    );
  }

  try {
    await setUserRole(email.toLowerCase().trim(), role);
  } catch (err) {
    console.error("[roles] setUserRole failed:", err);
    return NextResponse.json({ error: "Failed to save role" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  try {
    await removeUserRole(email.toLowerCase().trim());
  } catch (err) {
    console.error("[roles] removeUserRole failed:", err);
    return NextResponse.json({ error: "Failed to remove role" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
