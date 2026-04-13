import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgProgress } from "@/lib/progress-store";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgProgress = getOrgProgress();
  return NextResponse.json(orgProgress);
}
