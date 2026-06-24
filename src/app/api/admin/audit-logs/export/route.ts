import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { csvCell } from "@/app/api/admin/iso-acks/export/route";
import { buildAuditWhere, parseDate } from "@/app/api/admin/audit-logs/route";

/**
 * GET /api/admin/audit-logs/export
 *
 * CSV download of the security audit trail for ISO auditors. Honours the same
 * filters as the list endpoint (`action`, `actorId`, `targetType`, `targetId`,
 * `from`, `to`) but does not paginate — the full filtered set is one file.
 * Same in-memory build as iso-acks/export; swap to a ReadableStream if the
 * corpus ever exceeds ~10k rows.
 *
 * Evidence integrity (ISO 27001 A.8.15): the CSV response carries an
 * `X-Content-SHA256` header over the exact bytes returned, plus row count and
 * generation timestamp. `?format=manifest` returns the same metadata as JSON so
 * an auditor can re-hash the handed-over CSV and confirm it was not altered
 * after export. The manifest and CSV are built from one query, so their hashes
 * match for identical filters.
 */

type CsvFilters = {
  action: string | null;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  from: Date | null;
  to: Date | null;
};

const CSV_HEADER = [
  "createdAt",
  "action",
  "actorEmail",
  "actorName",
  "targetType",
  "targetId",
  "metadata",
];

/** Build the audit CSV for the given filters. Returns the body + row count so
 *  the CSV and manifest paths stay in lock-step (one query, one hash). */
async function buildAuditCsv(
  filters: CsvFilters,
): Promise<{ csv: string; rowCount: number }> {
  const rows = await prisma.auditLog.findMany({
    where: buildAuditWhere(filters),
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true, email: true } } },
  });

  const lines: string[] = [CSV_HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt.toISOString(),
        r.action,
        // actorEmail snapshot first; fall back to the live actor row if present.
        r.actorEmail ?? r.actor?.email ?? "",
        r.actor?.name ?? "",
        r.targetType ?? "",
        r.targetId ?? "",
        r.metadata != null ? JSON.stringify(r.metadata) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return { csv: lines.join("\r\n") + "\r\n", rowCount: rows.length };
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

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

  const filters: CsvFilters = {
    action: url.searchParams.get("action"),
    actorId: url.searchParams.get("actorId"),
    targetType: url.searchParams.get("targetType"),
    targetId: url.searchParams.get("targetId"),
    from,
    to,
  };

  const { csv, rowCount } = await buildAuditCsv(filters);
  const sha256 = sha256Hex(csv);
  const generatedAt = new Date().toISOString();
  const today = generatedAt.slice(0, 10);

  // ?format=manifest → integrity descriptor instead of the file itself.
  if (url.searchParams.get("format") === "manifest") {
    return NextResponse.json(
      {
        algorithm: "sha256",
        sha256,
        encoding: "utf-8",
        filename: `audit-logs-${today}.csv`,
        rowCount,
        filters: {
          action: filters.action,
          actorId: filters.actorId,
          targetType: filters.targetType,
          targetId: filters.targetId,
          from: filters.from?.toISOString() ?? null,
          to: filters.to?.toISOString() ?? null,
        },
        generatedAt,
        generatedBy: auth.session?.user?.email ?? auth.userId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-logs-${today}.csv"`,
      "Cache-Control": "no-store",
      // Evidence-integrity headers: re-hash the downloaded bytes to verify.
      "X-Content-SHA256": sha256,
      "X-Audit-Export-Rows": String(rowCount),
      "X-Audit-Export-Generated": generatedAt,
    },
  });
}
