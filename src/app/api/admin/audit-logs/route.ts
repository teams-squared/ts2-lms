import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

/** Parse an ISO date string; return null on empty/invalid input. */
export function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Shared filter builder so the list and export routes stay in lock-step. */
export function buildAuditWhere(opts: {
  action?: string | null;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  from?: Date | null;
  to?: Date | null;
}): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (opts.action) where.action = opts.action;
  if (opts.actorId) where.actorId = opts.actorId;
  if (opts.targetType) where.targetType = opts.targetType;
  if (opts.targetId) where.targetId = opts.targetId;
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) where.createdAt.gte = opts.from;
    if (opts.to) where.createdAt.lte = opts.to;
  }
  return where;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

/**
 * GET /api/admin/audit-logs — paginated security audit trail (admin only).
 *
 * Filters: `action`, `actorId`, `targetType`, `targetId`, `from`, `to`.
 * Pagination: `limit` (1–500, default 100) + `offset`. Returns the matching
 * rows newest-first plus a `total` count for the active filter.
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

  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const where = buildAuditWhere({
    action: url.searchParams.get("action"),
    actorId: url.searchParams.get("actorId"),
    targetType: url.searchParams.get("targetType"),
    targetId: url.searchParams.get("targetId"),
    from,
    to,
  });

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ rows, total, limit, offset });
}
