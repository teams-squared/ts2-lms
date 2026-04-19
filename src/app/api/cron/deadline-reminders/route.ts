import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDueReminders } from "@/lib/deadline-reminders";
import { sendDeadlineReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://learn.teamsquared.io";

/** Maximum ms budget for the cron job to avoid Render's 60 s HTTP timeout. */
const BUDGET_MS = 50_000;

/** Enrollments fetched per page. */
const PAGE_SIZE = 200;

export async function GET(req: Request): Promise<NextResponse> {
  // ---------------------------------------------------------------------------
  // Auth: Bearer token required
  // ---------------------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ") || authHeader.slice(7) !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
  // ---------------------------------------------------------------------------
  // Paginate enrollments and compute candidates
  // ---------------------------------------------------------------------------
  const startMs = Date.now();
  const now = new Date();

  let sent = 0;
  let skippedAlreadyLogged = 0;
  let skippedCompleted = 0;
  let errors = 0;
  let truncated = false;
  const drySample: unknown[] = [];

  let skip = 0;
  while (true) {
    // Wall-clock budget check
    if (Date.now() - startMs > BUDGET_MS) {
      truncated = true;
      break;
    }

    const enrollments = await prisma.enrollment.findMany({
      skip,
      take: PAGE_SIZE,
      select: {
        userId: true,
        enrolledAt: true,
        user: { select: { email: true, name: true } },
        course: {
          select: {
            id: true,
            title: true,
            modules: {
              select: {
                lessons: {
                  where: { deadlineDays: { not: null } },
                  select: { id: true, title: true, deadlineDays: true },
                },
              },
            },
          },
        },
      },
    });

    if (enrollments.length === 0) break;

    // Attach lesson progress for each user in this page
    const userIds = [...new Set(enrollments.map((e) => e.userId))];
    const lessonIds = enrollments.flatMap((e) =>
      e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)),
    );

    const allProgress = lessonIds.length > 0
      ? await prisma.lessonProgress.findMany({
          where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
          select: { userId: true, lessonId: true, completedAt: true },
        })
      : [];

    // Build a map: userId → progress rows
    const progressByUser = new Map<
      string,
      Array<{ lessonId: string; completedAt: Date | null }>
    >();
    for (const p of allProgress) {
      if (!progressByUser.has(p.userId)) progressByUser.set(p.userId, []);
      progressByUser.get(p.userId)!.push(p);
    }

    // Attach to enrollments (shape expected by computeDueReminders)
    const enriched = enrollments.map((e) => ({
      ...e,
      lessonProgressForUser: progressByUser.get(e.userId) ?? [],
    }));

    const candidates = computeDueReminders(enriched, now);

    // Count skipped-completed (lessons that had no deadlineDays or were completed)
    const potentialCount = enriched.reduce(
      (acc, e) =>
        acc +
        e.course.modules.reduce((a, m) => a + m.lessons.length, 0),
      0,
    );
    skippedCompleted += potentialCount - candidates.length;

    if (candidates.length > 0) {
      // Batch-fetch existing log rows for this page of candidates
      const existingLogs = await prisma.deadlineReminderLog.findMany({
        where: {
          OR: candidates.map((c) => ({
            userId: c.userId,
            lessonId: c.lessonId,
            kind: c.kind,
          })),
        },
        select: { userId: true, lessonId: true, kind: true },
      });

      const loggedSet = new Set(
        existingLogs.map((l) => `${l.userId}:${l.lessonId}:${l.kind}`),
      );

      for (const candidate of candidates) {
        const key = `${candidate.userId}:${candidate.lessonId}:${candidate.kind}`;
        if (loggedSet.has(key)) {
          skippedAlreadyLogged++;
          continue;
        }

        if (dryRun) {
          if (drySample.length < 20) drySample.push(candidate);
          sent++;
          continue;
        }

        const lessonUrl = `${APP_URL}/courses/${candidate.courseId}/lessons/${candidate.lessonId}`;

        try {
          await sendDeadlineReminderEmail({
            to: candidate.userEmail,
            learnerName: candidate.userName,
            courseTitle: candidate.courseTitle,
            lessonTitle: candidate.lessonTitle,
            kind: candidate.kind,
            lessonUrl,
            daysOffset: candidate.daysOffset,
          });

          await prisma.deadlineReminderLog.create({
            data: {
              userId: candidate.userId,
              lessonId: candidate.lessonId,
              kind: candidate.kind,
            },
          });

          sent++;
        } catch (err) {
          // Unique-constraint violation from a concurrent run is expected — skip
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
            skippedAlreadyLogged++;
          } else {
            console.error("[cron/deadline-reminders] error for candidate", key, err);
            errors++;
          }
        }

        // Check budget inside inner loop too
        if (Date.now() - startMs > BUDGET_MS) {
          truncated = true;
          break;
        }
      }
    }

    if (truncated) break;
    skip += PAGE_SIZE;
    if (enrollments.length < PAGE_SIZE) break;
  }

  return NextResponse.json({
    dryRun,
    sent,
    skippedAlreadyLogged,
    skippedCompleted,
    errors,
    truncated,
    ...(dryRun ? { sample: drySample } : {}),
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron/deadline-reminders] fatal error", err);
    return NextResponse.json(
      { error: "Internal error", message, stack },
      { status: 500 },
    );
  }
}
