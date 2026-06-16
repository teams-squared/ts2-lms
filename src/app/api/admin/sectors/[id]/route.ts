import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPrismaError(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === code
  );
}

/** PATCH /api/admin/sectors/[id] — update label, description, or key. */
export async function PATCH(request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const body = (await request.json()) as {
    label?: string;
    key?: string;
    description?: string;
  };

  const data: { label?: string; key?: string; description?: string | null } =
    {};

  if (body.label !== undefined) {
    const label = body.label.trim();
    if (!label) {
      return NextResponse.json({ error: "label cannot be empty" }, { status: 400 });
    }
    data.label = label;
  }

  if (body.key !== undefined) {
    const key = slugify(body.key);
    if (!key) {
      return NextResponse.json(
        { error: "Could not derive a valid key from the provided input" },
        { status: 400 },
      );
    }
    data.key = key;
  }

  if (body.description !== undefined) {
    data.description = body.description.trim() || null;
  }

  try {
    const sector = await prisma.sector.update({
      where: { id },
      data,
    });
    await writeAuditLog({
      action: "sector.updated",
      actorId: authResult.userId,
      actorEmail: authResult.session?.user?.email,
      targetType: "sector",
      targetId: id,
      metadata: { changed: Object.keys(data) },
    });
    return NextResponse.json(sector);
  } catch (err: unknown) {
    if (isPrismaError(err, "P2002")) {
      return NextResponse.json(
        { error: "A sector with that key already exists" },
        { status: 409 },
      );
    }
    if (isPrismaError(err, "P2025")) {
      return NextResponse.json({ error: "Sector not found" }, { status: 404 });
    }
    throw err;
  }
}

/** DELETE /api/admin/sectors/[id] — delete a sector. */
export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireRole("admin");
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const before = await prisma.sector.findUnique({ where: { id }, select: { key: true, label: true } });

  try {
    await prisma.sector.delete({ where: { id } });
    await writeAuditLog({
      action: "sector.deleted",
      actorId: authResult.userId,
      actorEmail: authResult.session?.user?.email,
      targetType: "sector",
      targetId: id,
      metadata: { key: before?.key, label: before?.label },
    });
    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    if (isPrismaError(err, "P2003")) {
      return NextResponse.json(
        {
          error:
            "Cannot delete: this sector is still required by one or more courses or documents.",
        },
        { status: 409 },
      );
    }
    if (isPrismaError(err, "P2025")) {
      return NextResponse.json({ error: "Sector not found" }, { status: 404 });
    }
    throw err;
  }
}
