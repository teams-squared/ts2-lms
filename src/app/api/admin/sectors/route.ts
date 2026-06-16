import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** GET /api/admin/sectors — list all sectors ordered by label asc. */
export async function GET() {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const sectors = await prisma.sector.findMany({
    orderBy: { label: "asc" },
  });

  return NextResponse.json(sectors);
}

/** POST /api/admin/sectors — create a sector. */
export async function POST(request: Request) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const body = (await request.json()) as {
    label?: string;
    key?: string;
    description?: string;
  };

  const label = (body.label ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const key = body.key ? slugify(body.key) : slugify(label);
  if (!key) {
    return NextResponse.json(
      { error: "Could not derive a valid key from the provided input" },
      { status: 400 },
    );
  }

  try {
    const sector = await prisma.sector.create({
      data: {
        key,
        label,
        description: (body.description ?? "").trim() || null,
      },
    });
    await writeAuditLog({
      action: "sector.created",
      actorId: authResult.userId,
      actorEmail: authResult.session?.user?.email,
      targetType: "sector",
      targetId: sector.id,
      metadata: { key: sector.key, label: sector.label },
    });
    return NextResponse.json(sector, { status: 201 });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A sector with that key already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}
