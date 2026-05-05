import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { csvCell } from "@/app/api/admin/iso-acks/export/route";

/**
 * GET /api/admin/iso-coverage/export
 *
 * One CSV row per (outstanding user × policy). Includes the latest prior
 * ack (if any) so an auditor can distinguish "never ack'd" from "ack'd a
 * previous version, hasn't re-ack'd after the version bump."
 */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

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

  const header = [
    "courseTitle",
    "documentTitle",
    "documentCode",
    "currentVersion",
    "userName",
    "userEmail",
    "userRole",
    "enrolledAt",
    "lastSeenAckVersion",
    "lastSeenAckAt",
  ];

  const lines: string[] = [header.map(csvCell).join(",")];

  for (const l of lessons) {
    if (!l.policyDoc) continue;
    const policy = l.policyDoc;
    const enrollments = l.module.course.enrollments;

    const latestAckByUser = new Map<string, { version: string; at: Date }>();
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

    for (const e of enrollments) {
      if (ackedCurrent.has(e.user.id)) continue;
      const last = latestAckByUser.get(e.user.id);
      lines.push(
        [
          l.module.course.title,
          policy.documentTitle,
          policy.documentCode ?? "",
          policy.sourceVersion,
          e.user.name ?? "",
          e.user.email,
          e.user.role,
          e.enrolledAt.toISOString(),
          last?.version ?? "",
          last ? last.at.toISOString() : "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  const csv = lines.join("\r\n") + "\r\n";
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="iso-coverage-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
