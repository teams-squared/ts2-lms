import { getAllDocs } from "@/lib/docs";
import { auth } from "@/lib/auth";
import { hasAccess } from "@/lib/roles";
import { NextResponse } from "next/server";
import type { Role } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json([]);
  }

  const userRole = (session.user.role as Role) || "employee";
  const docs = await getAllDocs();
  const filtered = docs.filter((doc) => hasAccess(userRole, doc.minRole));
  return NextResponse.json(filtered);
}
