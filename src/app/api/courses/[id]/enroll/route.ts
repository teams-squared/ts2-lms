import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/** POST /api/courses/[id]/enroll — self-enrollment is disabled.
 *  Enrollments are managed by admins via /api/admin/enrollments. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Self-enrollment is disabled. Contact your administrator." },
    { status: 403 },
  );
}
