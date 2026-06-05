import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAuthorForRequirements, loadUserTiers } from "@/lib/clearance";
import { appLessonTypeToPrisma, type LessonType, type Role } from "@/lib/types";

/** Content types an internal doc may use (excludes quiz + policy_doc). */
const ALLOWED_TYPES: LessonType[] = ["text", "document", "html", "video", "link"];

export interface RequirementInput {
  sectorId: string;
  tier: number;
}

/** Validate + normalize the requirements array from a request body. */
export function parseRequirements(
  raw: unknown,
): { ok: true; reqs: RequirementInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "At least one clearance requirement is required" };
  }
  const seen = new Set<string>();
  const reqs: RequirementInput[] = [];
  for (const r of raw) {
    const sectorId = (r?.sectorId as string)?.trim();
    const tier = Number(r?.tier);
    if (!sectorId) return { ok: false, error: "Each requirement needs a sectorId" };
    if (!Number.isInteger(tier) || tier < 0) {
      return { ok: false, error: "Each requirement tier must be a non-negative integer" };
    }
    if (seen.has(sectorId)) {
      return { ok: false, error: "Duplicate sector in requirements" };
    }
    seen.add(sectorId);
    reqs.push({ sectorId, tier });
  }
  return { ok: true, reqs };
}

/**
 * POST /api/internal-docs — create an internal doc.
 * Body: { title, type, content?, category?, requirements: [{sectorId, tier}] }.
 * Author must satisfy EVERY requirement they stamp (or be admin); a doc must
 * carry >= 1 requirement so it can never be world-readable.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const role = session.user.role as Role;

  const body = await request.json();
  const title = (body.title as string)?.trim();
  const type = body.type as LessonType;
  const content = (body.content as string) || null;
  const category = (body.category as string)?.trim() || null;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Unsupported document type" }, { status: 400 });
  }

  const parsed = parseRequirements(body.requirements);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // All referenced sectors must exist.
  const sectorIds = parsed.reqs.map((r) => r.sectorId);
  const foundSectors = await prisma.sector.count({ where: { id: { in: sectorIds } } });
  if (foundSectors !== sectorIds.length) {
    return NextResponse.json({ error: "One or more sectors not found" }, { status: 404 });
  }

  // Authoring gate: must satisfy every requirement (admins bypass).
  if (role !== "admin") {
    const tiers = await loadUserTiers(userId);
    if (!canAuthorForRequirements(parsed.reqs, tiers)) {
      return NextResponse.json(
        { error: "You can only require clearances within your own grants." },
        { status: 403 },
      );
    }
  }

  const doc = await prisma.internalDoc.create({
    data: {
      title,
      type: appLessonTypeToPrisma(type),
      content,
      category,
      createdById: userId,
      clearanceRequirements: {
        create: parsed.reqs.map((r) => ({ sectorId: r.sectorId, tier: r.tier })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
