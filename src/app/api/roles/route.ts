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

  const body = await request.json();
  const { email, role } = body as { email: string; role: Role };

  if (!email || !role || !["admin", "manager", "employee"].includes(role)) {
    return NextResponse.json(
      { error: "Invalid email or role" },
      { status: 400 }
    );
  }

  await setUserRole(email.toLowerCase().trim(), role);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email } = body as { email: string };

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  await removeUserRole(email);
  return NextResponse.json({ success: true });
}
