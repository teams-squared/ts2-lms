import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { appRoleToPrisma } from "@/lib/types";
import type { Role } from "@/lib/types";
import { createEnrollments } from "@/lib/enrollments";
import { sendUserInviteEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: Role[] = ["admin", "course_manager", "employee"];

interface InviteBody {
  email?: string;
  name?: string | null;
  role?: Role;
  courseIds?: string[];
}

/**
 * POST /api/admin/users/invite
 *
 * Pre-creates a user row and optionally pre-enrolls them into courses, then
 * dispatches an invite email. When the invited user later signs in via SSO,
 * the jwt-callback upsert in src/lib/auth.ts merges into the same row by
 * email — so pre-assigned enrollments are waiting on their first login.
 *
 * Admin-only for inviting `admin` or `course_manager` users; course_manager
 * can invite `employee` users only.
 */
export async function POST(request: Request) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: inviterId, role: inviterRole } = authResult;

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() || null;
  const role = body.role ?? "employee";
  const courseIds = Array.isArray(body.courseIds) ? body.courseIds : [];

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (role !== "employee" && inviterRole !== "admin") {
    return NextResponse.json(
      { error: "Only admins can invite admins or course managers" },
      { status: 403 },
    );
  }

  // Duplicate guard — surface a clear 409 before we begin the transaction.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 },
    );
  }

  // Pre-create user + enrollments atomically.
  const { user, created, skipped, invalid, courseTitleMap } = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          role: appRoleToPrisma(role),
          invitedAt: new Date(),
          invitedById: inviterId,
        },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });

      const enrollmentResult =
        courseIds.length > 0
          ? await createEnrollments(tx, {
              userId: user.id,
              courseIds,
              enrolledById: inviterId,
            })
          : {
              created: [],
              skipped: [],
              invalid: [],
              courseTitleMap: new Map<string, string>(),
            };

      return { user, ...enrollmentResult };
    },
  );

  // Fire off the invite email. Don't fail the request if Resend is down —
  // the user row already exists and the admin can resend later.
  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    select: { name: true, email: true },
  });
  const inviterName = inviter?.name?.trim() || inviter?.email || "An administrator";
  const assignedCourses = created.map((c) => c.course.title);

  let emailSent = false;
  try {
    emailSent = await sendUserInviteEmail({
      to: email,
      inviterName,
      assignedCourses,
    });
  } catch (err) {
    console.error("[invite] Failed to send invite email", err);
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        createdAt: user.createdAt.toISOString(),
      },
      enrollmentCount: created.length,
      skippedCount: skipped.length,
      invalidCourseIds: invalid,
      emailSent,
      assignedCourseTitles: assignedCourses,
      // Debug hint in case the caller wants to surface invalid IDs
      courseTitles: Object.fromEntries(courseTitleMap),
    },
    { status: 201 },
  );
}
