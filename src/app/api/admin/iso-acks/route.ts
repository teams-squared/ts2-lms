import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * GET /api/admin/iso-acks
 *
 * Paginated list of POLICY_DOC acknowledgements for the in-app audit log.
 * The CSV export endpoint at `/export` shares the same filter shape but
 * does not paginate — auditors get the whole result set in one file.
 *
 * Query params:
 *   - from       optional ISO date (inclusive lower bound on acknowledgedAt)
 *   - to         optional ISO date (inclusive upper bound on acknowledgedAt)
 *   - page       1-indexed (default 1)
 *   - pageSize   default 50, capped at 200
 *
 * Response: { acks: AckRow[], total, page, pageSize }
 */
export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const pageRaw = url.searchParams.get("page");
  const pageSizeRaw = url.searchParams.get("pageSize");

  const from = parseDate(fromRaw);
  const to = parseDate(toRaw);
  if (fromRaw && !from) {
    return NextResponse.json({ error: "Invalid `from` date" }, { status: 400 });
  }
  if (toRaw && !to) {
    return NextResponse.json({ error: "Invalid `to` date" }, { status: 400 });
  }

  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(pageSizeRaw ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE),
  );

  const where = buildAckWhere({ from, to });

  const [rows, total] = await Promise.all([
    prisma.lessonProgress.findMany({
      where,
      orderBy: { acknowledgedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        acknowledgedAt: true,
        acknowledgedVersion: true,
        acknowledgedETag: true,
        acknowledgedHash: true,
        acknowledgedAttestationText: true,
        acknowledgedDwellSeconds: true,
        acknowledgedSharePointItemId: true,
        user: { select: { id: true, name: true, email: true } },
        lesson: {
          select: {
            id: true,
            title: true,
            module: { select: { course: { select: { title: true } } } },
            policyDoc: {
              select: {
                documentTitle: true,
                documentCode: true,
                sourceVersion: true,
              },
            },
          },
        },
      },
    }),
    prisma.lessonProgress.count({ where }),
  ]);

  const acks = rows.map((r) => ({
    id: r.id,
    acknowledgedAt: r.acknowledgedAt,
    employee: {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
    },
    courseTitle: r.lesson.module.course.title,
    documentTitle: r.lesson.policyDoc?.documentTitle ?? r.lesson.title,
    documentCode: r.lesson.policyDoc?.documentCode ?? null,
    // Snapshot is the source of truth for what the user actually attested
    // to. Falling back to the live PolicyDocLesson version is just a
    // safety net for legacy rows; new rows should always have the snapshot.
    documentVersion:
      r.acknowledgedVersion ?? r.lesson.policyDoc?.sourceVersion ?? null,
    auditHash: r.acknowledgedHash ?? null,
    auditETag: r.acknowledgedETag ?? null,
    attestationText: r.acknowledgedAttestationText ?? null,
    dwellSeconds: r.acknowledgedDwellSeconds ?? null,
    sourceItemId: r.acknowledgedSharePointItemId ?? null,
  }));

  return NextResponse.json({ acks, total, page, pageSize });
}

/** Shared WHERE clause for the list and CSV-export endpoints. POLICY_DOC
 *  type filter ensures we never include non-policy lessons that might have
 *  acknowledgedAt set somehow (defence in depth — the email hook only ever
 *  writes the snapshot for POLICY_DOC). */
export function buildAckWhere({
  from,
  to,
}: {
  from: Date | null;
  to: Date | null;
}) {
  return {
    acknowledgedAt: {
      not: null,
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
    lesson: { type: "POLICY_DOC" as const },
  };
}

export function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
