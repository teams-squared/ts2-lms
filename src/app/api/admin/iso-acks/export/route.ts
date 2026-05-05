import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { buildAckWhere, parseDate } from "@/app/api/admin/iso-acks/route";

/**
 * GET /api/admin/iso-acks/export
 *
 * CSV download of POLICY_DOC acknowledgements for ISO auditors. Honours
 * the same `from`/`to` filters as the list endpoint but does not
 * paginate — the whole result set is streamed back as one file.
 *
 * Volume in this LMS is small (10s–100s/year for a single org), so we
 * build the CSV in memory rather than streaming row-by-row. If the
 * audit corpus ever grows past ~10k rows, swap to a ReadableStream.
 */
export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");

  const from = parseDate(fromRaw);
  const to = parseDate(toRaw);
  if (fromRaw && !from) {
    return NextResponse.json({ error: "Invalid `from` date" }, { status: 400 });
  }
  if (toRaw && !to) {
    return NextResponse.json({ error: "Invalid `to` date" }, { status: 400 });
  }

  const rows = await prisma.lessonProgress.findMany({
    where: buildAckWhere({ from, to }),
    orderBy: { acknowledgedAt: "desc" },
    select: {
      acknowledgedAt: true,
      acknowledgedVersion: true,
      acknowledgedETag: true,
      acknowledgedHash: true,
      user: { select: { name: true, email: true } },
      lesson: {
        select: {
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
  });

  const header = [
    "acknowledgedAt",
    "employeeName",
    "employeeEmail",
    "courseTitle",
    "documentTitle",
    "documentCode",
    "documentVersion",
    "auditHash",
    "auditETag",
  ];

  const lines: string[] = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.acknowledgedAt ? r.acknowledgedAt.toISOString() : "",
        r.user.name ?? "",
        r.user.email,
        r.lesson.module.course.title,
        r.lesson.policyDoc?.documentTitle ?? r.lesson.title,
        r.lesson.policyDoc?.documentCode ?? "",
        r.acknowledgedVersion ?? r.lesson.policyDoc?.sourceVersion ?? "",
        r.acknowledgedHash ?? "",
        r.acknowledgedETag ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // Excel + most CSV tools expect CRLF line endings.
  const csv = lines.join("\r\n") + "\r\n";

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="iso-acks-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** RFC-4180 CSV cell encoding: quote any cell containing comma, quote,
 *  CR, or LF, and double any interior quotes. Quoting unconditionally is
 *  also valid but produces noisier files; we only quote when needed. */
export function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
