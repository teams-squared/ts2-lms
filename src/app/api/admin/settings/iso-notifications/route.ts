import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

const SINGLETON_ID = "singleton";

const PatchSchema = z.object({
  enabled: z.boolean(),
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
    // Default `enabled` to false when no row exists yet — fresh installs
    // shouldn't fire emails until the admin explicitly opts in.
    enabled: settings?.enabled ?? false,
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

  const enabled = parsed.data.enabled;
  const toEmails = dedup(parsed.data.toEmails);
  const ccEmails = dedup(parsed.data.ccEmails);

  const updated = await prisma.isoNotificationSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      enabled,
      toEmails,
      ccEmails,
      updatedBy: auth.userId,
    },
    update: {
      enabled,
      toEmails,
      ccEmails,
      updatedBy: auth.userId,
    },
  });

  return NextResponse.json({
    enabled: updated.enabled,
    toEmails: updated.toEmails,
    ccEmails: updated.ccEmails,
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedBy,
  });
}
