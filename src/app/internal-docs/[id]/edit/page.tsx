import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  loadAuthorSectorOptions,
  loadUserTiers,
  canAuthorForRequirements,
} from "@/lib/clearance";
import { InternalDocEditor } from "@/components/internal-docs/InternalDocEditor";
import { prismaLessonTypeToApp, type Role } from "@/lib/types";
import type { LessonContentType } from "@/components/courses/LessonContentEditor";

export const dynamic = "force-dynamic";

export default async function EditInternalDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  const { id } = await params;

  const doc = await prisma.internalDoc.findUnique({
    where: { id },
    include: {
      clearanceRequirements: {
        select: { sectorId: true, tier: true, sector: { select: { label: true } } },
      },
    },
  });
  if (!doc) notFound();

  // Must currently satisfy the doc to edit it (admins bypass). 404 (not 403)
  // so we don't reveal a doc the user can't see.
  if (role !== "admin") {
    const tiers = await loadUserTiers(session.user.id);
    if (!canAuthorForRequirements(doc.clearanceRequirements, tiers)) {
      notFound();
    }
  }

  const { sectors, minTierBySector } = await loadAuthorSectorOptions(session.user.id, role);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <Link href={`/internal-docs/${id}`} className="text-sm text-primary hover:underline">
          ← Back to document
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">Edit document</h1>
      </div>
      <InternalDocEditor
        docId={id}
        initialTitle={doc.title}
        initialType={prismaLessonTypeToApp(doc.type) as LessonContentType}
        initialContent={doc.content ?? ""}
        initialCategory={doc.category ?? ""}
        initialRequirements={doc.clearanceRequirements.map((r) => ({
          sectorId: r.sectorId,
          sectorLabel: r.sector.label,
          tier: r.tier,
        }))}
        sectors={sectors}
        minTierBySector={minTierBySector}
      />
    </div>
  );
}
