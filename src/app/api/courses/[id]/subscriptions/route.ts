import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** Verify caller is admin, or manager who created the course. */
async function authorize(courseId: string) {
  const session = await auth();
  if (!session?.user?.email) return null;

  const { role } = session.user;
  if (role === "admin") return session;

  if (role === "manager") {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { createdById: true },
    });
    if (course && course.createdById === session.user.id) return session;
  }

  return null;
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
