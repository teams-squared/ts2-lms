import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

/**
 * GET /api/admin/iso-coverage
 *
 * Per-policy coverage rollup for ISO 27001 Stage-2 audit evidence:
 *   - Each POLICY_DOC lesson lists who is required to ack (= enrolled in
 *     the parent course) vs. who has actually ack'd the *current* version.
 *   - Outstanding = required users minus those with a LessonProgress row
 *     where acknowledgedVersion === policyDoc.sourceVersion.
 *
 * Note: an enrolled user with `enrollment.completedAt != null` who has
 * NOT ack'd the current version is still outstanding — version bumps
 * supersede prior course completion (the sync job clears prior acks on
 * version change but a user who completed before re-enrolling needs to
 * be flagged regardless).
 */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  // One pass: every POLICY_DOC lesson, with its policyDoc, parent course
  // (title + all enrollments → enrolled users), and the LessonProgress
  // rows that ack'd this lesson at any version.
  const lessons = await prisma.lesson.findMany({
    where: { type: "POLICY_DOC" },
    select: {
      id: true,
      title: true,
      module: {
        select: {
          courseId: true,
          course: {
            select: {
              title: true,
              enrollments: {
                select: {
                  enrolledAt: true,
                  user: {
                    select: { id: true, name: true, email: true, role: true },
                  },
                },
              },
            },
          },
        },
      },
      policyDoc: {
        select: {
          documentTitle: true,
          documentCode: true,
          sourceVersion: true,
          sourceETag: true,
        },
      },
      progress: {
        where: { acknowledgedVersion: { not: null } },
        select: {
          userId: true,
          acknowledgedAt: true,
          acknowledgedVersion: true,
        },
      },
    },
  });

  const rows = lessons
    .filter((l) => l.policyDoc != null)
    .map((l) => {
      const policy = l.policyDoc!;
      const enrollments = l.module.course.enrollments;
      const enrolled = enrollments.map((e) => ({
        ...e.user,
        enrolledAt: e.enrolledAt,
      }));

      // Build a map of userId -> latest ack on this lesson (any version).
      // Used to surface "last seen ack" so an auditor can tell if the
      // outstanding user has previously engaged or never has.
      const latestAckByUser = new Map<
        string,
        { version: string; at: Date }
      >();
      for (const p of l.progress) {
        if (!p.acknowledgedVersion || !p.acknowledgedAt) continue;
        const existing = latestAckByUser.get(p.userId);
        if (!existing || p.acknowledgedAt > existing.at) {
          latestAckByUser.set(p.userId, {
            version: p.acknowledgedVersion,
            at: p.acknowledgedAt,
          });
        }
      }

      const ackedCurrent = new Set(
        l.progress
          .filter((p) => p.acknowledgedVersion === policy.sourceVersion)
          .map((p) => p.userId),
      );

      const outstanding = enrolled
        .filter((u) => !ackedCurrent.has(u.id))
        .map((u) => {
          const last = latestAckByUser.get(u.id);
          return {
            userId: u.id,
            userName: u.name,
            userEmail: u.email,
            userRole: u.role,
            enrolledAt: u.enrolledAt,
            lastSeenAckVersion: last?.version ?? null,
            lastSeenAckAt: last?.at ?? null,
          };
        });

      return {
        lessonId: l.id,
        courseId: l.module.courseId,
        courseTitle: l.module.course.title,
        documentTitle: policy.documentTitle,
        documentCode: policy.documentCode,
        currentVersion: policy.sourceVersion,
        currentETag: policy.sourceETag,
        enrolledCount: enrolled.length,
        ackedCount: ackedCurrent.size,
        outstandingCount: outstanding.length,
        outstanding,
      };
    })
    // Sort: lowest coverage first — auditor sees the worst-covered
    // policy at the top.
    .sort((a, b) => {
      const ratioA = a.enrolledCount === 0 ? 1 : a.ackedCount / a.enrolledCount;
      const ratioB = b.enrolledCount === 0 ? 1 : b.ackedCount / b.enrolledCount;
      return ratioA - ratioB;
    });

  return NextResponse.json({ policies: rows });
}
