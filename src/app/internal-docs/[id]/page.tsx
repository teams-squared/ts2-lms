import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { satisfiesClearance, canAuthorForRequirements, loadUserTiers } from "@/lib/clearance";
import { LessonViewer } from "@/components/courses/LessonViewer";
import { prismaLessonTypeToApp, type Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InternalDocViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
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

  // Clearance gate — deny by default (404, don't reveal existence).
  let canEdit = role === "admin";
  if (role !== "admin") {
    const tiers = await loadUserTiers(userId);
    if (!satisfiesClearance(doc.clearanceRequirements, tiers, false)) {
      notFound();
    }
    canEdit = canAuthorForRequirements(doc.clearanceRequirements, tiers);
  }

  // Best-effort read audit — fire and forget.
  void prisma.internalDocView
    .create({ data: { internalDocId: doc.id, userId } })
    .catch((err) => {
      console.error("[internal-docs] view log failed:", err);
    });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/internal-docs" className="text-sm text-primary hover:underline">
          ← Internal docs
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground-subtle">
            {doc.clearanceRequirements.map((r) => `${r.sector.label} ≤${r.tier}`).join(" · ")}
          </span>
          {canEdit && (
            <Link
              href={`/internal-docs/${id}/edit`}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-muted transition-colors"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      <LessonViewer
        title={doc.title}
        type={prismaLessonTypeToApp(doc.type)}
        content={doc.content}
        videoSrc={`/api/internal-docs/${id}/video`}
      />
    </div>
  );
}
