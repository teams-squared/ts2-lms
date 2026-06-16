import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { loadMarkingQueue } from "@/lib/marking";

/** GET /api/admin/marking — return the pending-mark assessment queue. */
export async function GET() {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId, role } = authResult;

  const queue = await loadMarkingQueue(userId, role);
  if (queue === null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ queue });
}
