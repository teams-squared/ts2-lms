import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  order: z
    .array(z.object({ id: z.string().min(1), sortOrder: z.number().int() }))
    .min(1),
});

/**
 * PATCH /api/admin/iso-library/entries/reorder
 *
 * Bulk sortOrder rewrite. Caller sends the full intended order. All updates
 * happen in a single transaction.
 */
export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    parsed.data.order.map(({ id, sortOrder }) =>
      prisma.isoLibraryEntry.update({
        where: { id },
        data: { sortOrder },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
