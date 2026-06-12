import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageCourse } from "@/lib/courseAccess";
import type { Role } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** Verify the caller may manage THIS course (admin or its course_manager).
 *  Role alone is insufficient — a course_manager may only touch courses they
 *  manage, else any manager could edit any course's subscriber list (IDOR). */
async function authorize(courseId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const allowed = await canManageCourse(
    session.user.id,
    session.user.role as Role,
    courseId,
  );
  return allowed ? session : null;
}

/** GET /api/courses/[id]/subscriptions — list subscribed emails. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await authorize(id);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subs = await prisma.courseEmailSubscription.findMany({
    where: { courseId: id },
    select: { email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(subs);
}

/** POST /api/courses/[id]/subscriptions — add an email subscription. */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await authorize(id);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Check course exists
  const course = await prisma.course.findUnique({ where: { id }, select: { id: true } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Upsert to handle duplicates gracefully
  const sub = await prisma.courseEmailSubscription.upsert({
    where: { courseId_email: { courseId: id, email } },
    update: {},
    create: { courseId: id, email },
    select: { email: true, createdAt: true },
  });

  return NextResponse.json(sub, { status: 201 });
}

/** DELETE /api/courses/[id]/subscriptions — remove an email subscription. */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await authorize(id);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  await prisma.courseEmailSubscription.deleteMany({
    where: { courseId: id, email },
  });

  return NextResponse.json({ ok: true });
}
