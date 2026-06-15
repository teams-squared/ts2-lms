import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { csvCell } from "@/app/api/admin/iso-acks/export/route";
import { buildAuditWhere, parseDate } from "@/app/api/admin/audit-logs/route";

/**
 * GET /api/admin/audit-logs/export
 *
 * CSV download of the security audit trail for ISO auditors. Honours the
 * same filters as the list endpoint (`action`, `actorId`, `targetType`,
 * `targetId`, `from`, `to`) but does not paginate — the full filtered set
 * is streamed back as one file. Same in-memory build as iso-acks/export;
 * swap to a ReadableStream if the corpus ever exceeds ~10k rows.
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

  const rows = await prisma.auditLog.findMany({
    where: buildAuditWhere({
      action: url.searchParams.get("action"),
      actorId: url.searchParams.get("actorId"),
      targetType: url.searchParams.get("targetType"),
      targetId: url.searchParams.get("targetId"),
      from,
      to,
    }),
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true, email: true } } },
  });

  const header = [
    "createdAt",
    "action",
    "actorEmail",
    "actorName",
    "targetType",
    "targetId",
    "metadata",
  ];

  const lines: string[] = [header.map(csvCell).join(",")];
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
  const csv = lines.join("\r\n") + "\r\n";

  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-logs-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
