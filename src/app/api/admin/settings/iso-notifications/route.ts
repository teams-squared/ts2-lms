import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

const SINGLETON_ID = "singleton";

const PatchSchema = z.object({
  toEmails: z
    .array(z.string().trim().toLowerCase().email())
    .max(50, "Too many recipients"),
  ccEmails: z
    .array(z.string().trim().toLowerCase().email())
    .max(50, "Too many recipients"),
});

function dedup(emails: string[]): string[] {
  return [...new Set(emails)];
}

/** GET — fetch current ISO notification settings (admin-only). */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const settings = await prisma.isoNotificationSettings.findUnique({
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({
    toEmails: settings?.toEmails ?? [],
    ccEmails: settings?.ccEmails ?? [],
    updatedAt: settings?.updatedAt ?? null,
    updatedBy: settings?.updatedBy ?? null,
  });
}

/** PATCH — replace the To/Cc lists (admin-only). */
export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const toEmails = dedup(parsed.data.toEmails);
  const ccEmails = dedup(parsed.data.ccEmails);

  const updated = await prisma.isoNotificationSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      toEmails,
      ccEmails,
      updatedBy: auth.userId,
    },
    update: {
      toEmails,
      ccEmails,
      updatedBy: auth.userId,
    },
  });

  return NextResponse.json({
    toEmails: updated.toEmails,
    ccEmails: updated.ccEmails,
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedBy,
  });
}
