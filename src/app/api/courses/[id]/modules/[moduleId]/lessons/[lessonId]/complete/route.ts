import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardXp } from "@/lib/xp";
import { trackEvent } from "@/lib/posthog-server";
import { sendCourseCompletionEmail, sendIsoAcknowledgementEmail } from "@/lib/email";
import { computeCourseCompletionStats } from "@/lib/enrollments";

type Params = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

/** POST .../lessons/[lessonId]/complete — mark a lesson complete for the current user (idempotent). */
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;

  // Verify the lesson exists and belongs to the correct module and course.
  // We also pull the PolicyDocLesson row (if any) so we can stamp the audit
  // snapshot in the same write — server-trusted, never client-supplied.
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        select: {
          courseId: true,
          course: { select: { title: true } },
        },
      },
      policyDoc: {
        select: {
          sourceVersion: true,
          sourceETag: true,
          renderedHTMLHash: true,
          documentTitle: true,
          documentCode: true,
        },
      },
    },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // POLICY_DOC lessons must have a synced PolicyDocLesson row before they
  // can be acknowledged. Without one, there's nothing to snapshot — the
  // admin hasn't finished binding the lesson to a SharePoint doc yet.
  if (lesson.type === "POLICY_DOC" && !lesson.policyDoc) {
    return NextResponse.json(
      { error: "Policy document not yet synced — ask an admin." },
      { status: 409 },
    );
  }

  // User must be enrolled to track progress
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    return NextResponse.json(
      { error: "Must be enrolled to track progress" },
      { status: 403 },
    );
  }

  // Locked enrollments are read-only. The learner can still browse lessons
  // for review, but nothing they do can add/remove progress rows or re-fire
  // the course-completion modal. Only an admin reset (clearing
  // enrollment.completedAt) unlocks the course again.
  if (enrollment.completedAt != null) {
    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    return NextResponse.json({
      completed: existing?.completedAt != null,
      completedAt: existing?.completedAt ?? null,
      xpAwarded: 0,
      newAchievements: [],
      courseComplete: false,
      courseStats: null,
      locked: true,
    });
  }

  const now = new Date();

  // For POLICY_DOC lessons, stamp the audit snapshot from the latest
  // PolicyDocLesson row. This is the auditor-visible proof of *which*
  // version the learner attested to reading. Pulled server-side so the
  // client cannot lie about which version they saw.
  const policyAuditFields =
    lesson.type === "POLICY_DOC" && lesson.policyDoc
      ? {
          acknowledgedAt: now,
          acknowledgedVersion: lesson.policyDoc.sourceVersion,
          acknowledgedETag: lesson.policyDoc.sourceETag,
          acknowledgedHash: lesson.policyDoc.renderedHTMLHash,
        }
      : {};

  // Race-safe transition detection. Two requests racing on the same
  // (userId, lessonId) must yield exactly one "transitioned" outcome —
  // otherwise XP, achievements, ISO ack emails, and course-completion
  // emails all double-fire on a quick double-click.
  //
  // Strategy:
  //   1. Try CREATE. The unique constraint on (userId, lessonId) means
  //      only one concurrent request can win the create — that one
  //      transitioned (incomplete → complete in a single shot).
  //   2. If create fails with P2002 (unique violation), fall back to a
  //      conditional UPDATE that requires `completedAt: null`. The
  //      database serialises this — exactly one of the racing requests
  //      flips a non-null completedAt; the rest see count=0.
  //
  // `transitioned` drives the side-effect blocks below.
  let progress: Awaited<ReturnType<typeof prisma.lessonProgress.findUnique>>;
  let transitioned: boolean;
  try {
    progress = await prisma.lessonProgress.create({
      data: {
        userId,
        lessonId,
        startedAt: now,
        completedAt: now,
        ...policyAuditFields,
      },
    });
    transitioned = true;
  } catch (err: unknown) {
    // P2002 = unique constraint violation; row already exists.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const updateResult = await prisma.lessonProgress.updateMany({
        where: { userId, lessonId, completedAt: null },
        data: { completedAt: now, ...policyAuditFields },
      });
      transitioned = updateResult.count === 1;
      progress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      });
      if (!progress) {
        // Should be impossible after the unique-violation path.
        throw new Error("LessonProgress disappeared mid-write");
      }
    } else {
      throw err;
    }
  }

  // Separate analytics for policy doc acknowledgements — distinct from
  // generic lesson completion because auditors will pull these by name.
  // Only fires on the genuine transition; re-clicks don't re-send.
  if (transitioned && lesson.type === "POLICY_DOC" && lesson.policyDoc) {
    trackEvent(userId, "policy_doc_acknowledged", {
      courseId,
      moduleId,
      lessonId,
      sourceVersion: lesson.policyDoc.sourceVersion,
      renderedHTMLHash: lesson.policyDoc.renderedHTMLHash,
    });

    // Audit-trail email to ISO Officer / ISO Owner. Recipients live in the
    // IsoNotificationSettings singleton (configured via /admin/settings).
    // No recipients = feature off; the ack itself still records to the DB.
    // The acknowledging employee is Cc'd as a personal receipt.
    try {
      const [settings, userData] = await Promise.all([
        prisma.isoNotificationSettings.findUnique({ where: { id: "singleton" } }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }),
      ]);
      if (settings && settings.toEmails.length > 0 && userData) {
        // Cc admin-configured Cc list + the employee themselves (dedup; never
        // duplicate into Cc if they're already in To).
        const ccSet = new Set<string>(settings.ccEmails);
        if (!settings.toEmails.includes(userData.email)) {
          ccSet.add(userData.email);
        }
        sendIsoAcknowledgementEmail({
          to: settings.toEmails,
          cc: [...ccSet],
          employeeName: userData.name,
          employeeEmail: userData.email,
          courseTitle: lesson.module.course.title,
          documentTitle: lesson.policyDoc.documentTitle,
          documentCode: lesson.policyDoc.documentCode,
          documentVersion: lesson.policyDoc.sourceVersion,
          acknowledgedAt: now,
          acknowledgedHash: lesson.policyDoc.renderedHTMLHash,
        }).catch((err) =>
          console.error("[email] ISO acknowledgement send failed:", err),
        );
      }
    } catch (err) {
      // Non-critical: never fail the ack write because of an email outage
      console.error("[email] ISO acknowledgement settings lookup failed:", err);
    }
  }

  // Award XP and track event — only on the genuine transition. Re-clicks
  // (which still update completedAt to refresh the timestamp) must not
  // double-award XP or double-count completions in analytics.
  let newAchievements: { key: string; title: string; icon: string }[] = [];
  if (transitioned) {
    const xpResult = await awardXp(userId, 10);
    newAchievements = xpResult.newAchievements;
    trackEvent(userId, "lesson_completed", { courseId, moduleId, lessonId });
  }

  // ── Course completion check ───────────────────────────────────────────────
  // firstCompletion fires exactly once per enrollment: when all lessons are done
  // AND enrollment.completedAt is still null. We use a conditional updateMany
  // (WHERE completedAt: null) to win the race atomically — two simultaneous
  // requests both seeing every lesson as complete will only have one of them
  // succeed in flipping completedAt to non-null, so the side-effect block
  // (XP bonus, analytics, completion emails) fires exactly once.
  //
  // Skipping this entirely when `!transitioned` is also correct: if this
  // request didn't actually flip a lesson incomplete→complete, the course
  // can't have just become complete because of THIS request. Saves a
  // count() query on every re-click.
  let courseComplete = false;
  let courseStats: {
    courseTitle: string;
    totalLessons: number;
    completedLessons: number;
    xpEarned: number;
    daysTaken: number;
  } | null = null;

  if (transitioned) {
    try {
      const allModules = await prisma.module.findMany({
        where: { courseId },
        include: { lessons: { select: { id: true } } },
      });
      const allLessonIds = (allModules ?? []).flatMap((m) => m.lessons.map((l) => l.id));

      if (allLessonIds.length > 0) {
        const completedCount = await prisma.lessonProgress.count({
          where: { userId, lessonId: { in: allLessonIds }, completedAt: { not: null } },
        });

        if (completedCount >= allLessonIds.length) {
          // Conditional update: only flip enrollment.completedAt if it's
          // still null. Concurrent requests racing past the lessonProgress
          // gate above all converge here; exactly one wins.
          const stamp = await prisma.enrollment.updateMany({
            where: { id: enrollment.id, completedAt: null },
            data: { completedAt: now },
          });

          if (stamp.count === 1) {
            // Award course-completion XP bonus
            await awardXp(userId, 100);

            // Fire analytics event
            const stats = await computeCourseCompletionStats(userId, courseId, enrollment.enrolledAt);
            trackEvent(userId, "course_completed", {
              courseId,
              xpEarned: stats.xpEarned,
              daysTaken: stats.daysTaken,
              lessonCount: stats.totalLessons,
            });

            // Send completion alert emails
            const [subs, userData] = await Promise.all([
              prisma.courseEmailSubscription.findMany({ where: { courseId }, select: { email: true } }),
              prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
            ]);
            if (subs.length > 0) {
              sendCourseCompletionEmail(
                subs.map((s) => s.email),
                userData?.name ?? userData?.email ?? "A user",
                stats.courseTitle,
              ).catch((err) => console.error("[email] completion alert failed:", err));
            }

            courseComplete = true;
            courseStats = stats;
          }
          // stamp.count === 0: another concurrent request already stamped
          // it. No-op — the response below shows courseComplete: false for
          // this losing request, which is correct (the modal already fired
          // on the winning request's response).
        }
      }
    } catch {
      // Course completion check is non-critical; don't fail the request
    }
  }

  return NextResponse.json({
    completed: true,
    completedAt: progress.completedAt,
    // xpAwarded reflects what THIS request actually awarded — 0 if this
    // was a re-click on an already-complete lesson, 10 on a real
    // transition. Prevents the UI from flashing a fake "+10 XP" toast.
    xpAwarded: transitioned ? 10 : 0,
    newAchievements: newAchievements.map((a) => ({
      key: a.key,
      title: a.title,
      icon: a.icon,
    })),
    courseComplete,
    courseStats,
  });
}

/** DELETE .../lessons/[lessonId]/complete — unmark a lesson as complete (clears completedAt).
 *
 * NOTE: enrollment.completedAt is intentionally NOT reset here. "You earned the
 * completion" is a sticky state — the modal should never re-fire for a course
 * the learner already crossed the finish line on.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId, moduleId, lessonId } = await params;
  const userId = session.user.id;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    return NextResponse.json(
      { error: "Must be enrolled to track progress" },
      { status: 403 },
    );
  }

  // Locked at completed — only an admin reset can clear progress on a
  // completed enrollment. UI mirrors this by hiding the unmark button, but
  // we enforce it here too.
  if (enrollment.completedAt != null) {
    return NextResponse.json(
      { error: "Course is locked at completed. Ask an admin to reset progress." },
      { status: 409 },
    );
  }

  await prisma.lessonProgress.updateMany({
    where: { userId, lessonId },
    data: { completedAt: null },
  });

  return NextResponse.json({ completed: false });
}
