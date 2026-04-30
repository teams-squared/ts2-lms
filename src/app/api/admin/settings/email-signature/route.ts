import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";

const SINGLETON_ID = "singleton";

/** All fields are optional strings — admins can leave them blank to omit
 *  that row from the rendered signature. URL fields are validated when
 *  non-empty. Lengths are bounded to prevent absurd payloads. */
const PatchSchema = z.object({
  enabled: z.boolean(),
  signOff: z.string().trim().max(80),
  name: z.string().trim().max(120),
  title: z.string().trim().max(160),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]),
  phone: z.string().trim().max(40),
  websiteUrl: z.union([z.literal(""), z.string().trim().url()]),
  websiteLabel: z.string().trim().max(120),
  addressLine: z.string().trim().max(200),
  logoUrl: z.union([z.literal(""), z.string().trim().url()]),
  disclaimer: z.string().max(2000),
});

/** GET — fetch the email signature config (admin-only). */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const sig = await prisma.emailSignature.findUnique({
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({
    enabled: sig?.enabled ?? true,
    signOff: sig?.signOff ?? "Best regards,",
    name: sig?.name ?? "",
    title: sig?.title ?? "",
    email: sig?.email ?? "",
    phone: sig?.phone ?? "",
    websiteUrl: sig?.websiteUrl ?? "",
    websiteLabel: sig?.websiteLabel ?? "",
    addressLine: sig?.addressLine ?? "",
    logoUrl: sig?.logoUrl ?? "",
    disclaimer: sig?.disclaimer ?? "",
    updatedAt: sig?.updatedAt ?? null,
    updatedBy: sig?.updatedBy ?? null,
  });
}

/** PATCH — replace the signature config (admin-only). */
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

  const data = parsed.data;
  const updated = await prisma.emailSignature.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      ...data,
      updatedBy: auth.userId,
    },
    update: {
      ...data,
      updatedBy: auth.userId,
    },
  });

  return NextResponse.json({
    enabled: updated.enabled,
    signOff: updated.signOff,
    name: updated.name,
    title: updated.title,
    email: updated.email,
    phone: updated.phone,
    websiteUrl: updated.websiteUrl,
    websiteLabel: updated.websiteLabel,
    addressLine: updated.addressLine,
    logoUrl: updated.logoUrl,
    disclaimer: updated.disclaimer,
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedBy,
  });
}
