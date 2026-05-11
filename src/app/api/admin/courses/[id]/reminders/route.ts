import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { canManageCourse } from "@/lib/courseAccess";
import { computeDeadline } from "@/lib/deadlines";
import { sendManualOverdueReminderEmail } from "@/lib/email";

const NOTE_MAX = 500;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: callerId, role } = authResult;

  const { id: courseId } = await params;

  const allowed = await canManageCourse(callerId, role, courseId);
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only send reminders for courses you manage" },
      { status: 403 },
    );
  }

  let body: { userId?: string; note?: string };
  try {
    body = (await request.json()) as { userId?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetUserId = body.userId;
  if (!targetUserId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 },
    );
  }

  const rawNote = typeof body.note === "string" ? body.note.trim() : "";
  if (rawNote.length > NOTE_MAX) {
    return NextResponse.json(
      { error: `Note exceeds ${NOTE_MAX} characters` },
      { status: 400 },
    );
  }
  const note = rawNote.length > 0 ? rawNote : undefined;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: targetUserId, courseId } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: {
        select: {
          id: true,
          title: true,
          modules: {
            select: {
              lessons: {
                select: { id: true, title: true, deadlineDays: true },
              },
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 },
    );
  }

  if (enrollment.completedAt) {
    return NextResponse.json(
      { error: "Student has already completed this course" },
      { status: 400 },
    );
  }

  const lessons = enrollment.course.modules.flatMap((m) => m.lessons);
  const datedLessons = lessons.filter((l) => l.deadlineDays != null);

  const completedRows = datedLessons.length
    ? await prisma.lessonProgress.findMany({
        where: {
          userId: targetUserId,
          lessonId: { in: datedLessons.map((l) => l.id) },
          completedAt: { not: null },
        },
        select: { lessonId: true },
      })
    : [];
  const completedSet = new Set(completedRows.map((r) => r.lessonId));

  const now = new Date();
  const overdue = datedLessons.filter((l) => {
    if (completedSet.has(l.id)) return false;
    const deadline = computeDeadline(enrollment.enrolledAt, l.deadlineDays!);
    return deadline < now;
  });

  if (overdue.length === 0) {
    return NextResponse.json(
      { error: "Student has no overdue lessons in this course" },
      { status: 400 },
    );
  }

  const sender = await prisma.user.findUnique({
    where: { id: callerId },
    select: { name: true, email: true },
  });
  const senderName = sender?.name || sender?.email || "Your course manager";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://learn.teamsquared.io";
  const courseUrl = `${appUrl.replace(/\/$/, "")}/courses/${courseId}`;

  await sendManualOverdueReminderEmail({
    to: enrollment.user.email,
    learnerName: enrollment.user.name,
    courseTitle: enrollment.course.title,
    lessonTitles: overdue.map((l) => l.title),
    senderName,
    courseUrl,
    note,
  });

  await prisma.manualReminderLog.createMany({
    data: overdue.map((l) => ({
      userId: targetUserId,
      lessonId: l.id,
      sentById: callerId,
    })),
  });

  return NextResponse.json({
    sentTo: enrollment.user.email,
    lessonCount: overdue.length,
    sentAt: new Date().toISOString(),
  });
}
