import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAuthorForRequirements,
  satisfiesClearance,
  loadUserTiers,
} from "@/lib/clearance";
import { appLessonTypeToPrisma, type LessonType, type Role } from "@/lib/types";
import { parseRequirements } from "../route";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES: LessonType[] = ["text", "document", "html", "video", "link"];

async function loadDoc(id: string) {
  return prisma.internalDoc.findUnique({
    where: { id },
    include: {
      clearanceRequirements: { select: { sectorId: true, tier: true } },
    },
  });
}

/** GET /api/internal-docs/[id] — read a doc (clearance-gated). 404 when the
 *  viewer isn't cleared, to avoid revealing existence. */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const doc = await loadDoc(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ((session.user.role as Role) !== "admin") {
    const tiers = await loadUserTiers(session.user.id);
    // Internal docs deny by default — zero requirements is never readable.
    if (!satisfiesClearance(doc.clearanceRequirements, tiers, false)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json(doc);
}

/** PATCH /api/internal-docs/[id] — update fields + replace requirements.
 *  Author must satisfy both the existing and the new requirement sets. */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const role = session.user.role as Role;
  const { id } = await params;

  const doc = await loadDoc(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const title = (body.title as string)?.trim();
  const type = body.type as LessonType;
  const content = body.content === undefined ? doc.content : (body.content as string) || null;
  const category = body.category === undefined ? doc.category : (body.category as string)?.trim() || null;

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

  const sectorIds = parsed.reqs.map((r) => r.sectorId);
  const foundSectors = await prisma.sector.count({ where: { id: { in: sectorIds } } });
  if (foundSectors !== sectorIds.length) {
    return NextResponse.json({ error: "One or more sectors not found" }, { status: 404 });
  }

  // Authoring gate: must satisfy BOTH the current audience and the new one.
  if (role !== "admin") {
    const tiers = await loadUserTiers(userId);
    const canEditExisting = canAuthorForRequirements(doc.clearanceRequirements, tiers);
    const canSetNew = canAuthorForRequirements(parsed.reqs, tiers);
    if (!canEditExisting || !canSetNew) {
      return NextResponse.json(
        { error: "You can only edit docs whose clearances are within your own grants." },
        { status: 403 },
      );
    }
  }

  await prisma.$transaction([
    prisma.resourceClearanceRequirement.deleteMany({ where: { internalDocId: id } }),
    prisma.internalDoc.update({
      where: { id },
      data: {
        title,
        type: appLessonTypeToPrisma(type),
        content,
        category,
        updatedById: userId,
        clearanceRequirements: {
          create: parsed.reqs.map((r) => ({ sectorId: r.sectorId, tier: r.tier })),
        },
      },
    }),
  ]);

  return NextResponse.json({ id });
}

/** DELETE /api/internal-docs/[id] — author (satisfying the doc) or admin. */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as Role;
  const { id } = await params;

  const doc = await loadDoc(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role !== "admin") {
    const tiers = await loadUserTiers(session.user.id);
    if (!canAuthorForRequirements(doc.clearanceRequirements, tiers)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.internalDoc.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
