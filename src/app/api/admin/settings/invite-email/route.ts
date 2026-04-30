import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

const SINGLETON_ID = "singleton";

const PatchSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  bodyText: z.string().max(10_000),
  ccEmails: z
    .array(z.string().trim().toLowerCase().email())
    .max(50, "Too many CC recipients"),
});

function dedup(emails: string[]): string[] {
  return [...new Set(emails)];
}

/** GET — fetch the invite email template (admin-only). */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const tpl = await prisma.inviteEmailTemplate.findUnique({
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({
    subject: tpl?.subject ?? "You've been added to Teams Squared LMS",
    bodyText: tpl?.bodyText ?? "",
    ccEmails: tpl?.ccEmails ?? [],
    updatedAt: tpl?.updatedAt ?? null,
    updatedBy: tpl?.updatedBy ?? null,
  });
}

/** PATCH — replace the invite-email template (admin-only). */
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

  const subject = parsed.data.subject.trim();
  const bodyText = parsed.data.bodyText;
  const ccEmails = dedup(parsed.data.ccEmails);

  const updated = await prisma.inviteEmailTemplate.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      subject,
      bodyText,
      ccEmails,
      updatedBy: auth.userId,
    },
    update: {
      subject,
      bodyText,
      ccEmails,
      updatedBy: auth.userId,
    },
  });

  return NextResponse.json({
    subject: updated.subject,
    bodyText: updated.bodyText,
    ccEmails: updated.ccEmails,
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedBy,
  });
}
