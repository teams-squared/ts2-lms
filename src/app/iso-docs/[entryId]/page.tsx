import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IsoLibraryDocViewer } from "@/components/iso-library/IsoLibraryDocViewer";
import type {
  ReviewHistoryEntry,
  RevisionHistoryEntry,
} from "@/lib/policy-doc/types";

export const dynamic = "force-dynamic";

/**
 * /iso-docs/[entryId] — reference reader.
 *
 * Renders the original SharePoint PDF inline along with the Document
 * Control panel. No dwell gate, no attestation, no progress write — that
 * path stays inside the course flow.
 */
export default async function IsoDocsReaderPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    const { entryId } = await params;
    redirect(`/login?from=/iso-docs/${entryId}`);
  }

  const { entryId } = await params;

  const entry = await prisma.isoLibraryEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      policyDocLesson: {
        select: {
          documentTitle: true,
          documentCode: true,
          sourceVersion: true,
          approver: true,
          approvedOn: true,
          lastReviewedOn: true,
          sharePointDriveId: true,
          sharePointItemId: true,
          sharePointWebUrl: true,
          reviewHistory: true,
          revisionHistory: true,
        },
      },
    },
  });

  if (!entry) notFound();

  const doc = entry.policyDocLesson;
  const revisionHistory = (doc.revisionHistory as unknown as RevisionHistoryEntry[]) ?? [];
  const reviewHistory = (doc.reviewHistory as unknown as ReviewHistoryEntry[]) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href="/iso-docs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to ISO Docs
      </Link>

      <IsoLibraryDocViewer
        entryId={entry.id}
        documentTitle={doc.documentTitle}
        documentCode={doc.documentCode}
        sourceVersion={doc.sourceVersion}
        approver={doc.approver}
        approvedOn={doc.approvedOn?.toISOString() ?? null}
        lastReviewedOn={doc.lastReviewedOn?.toISOString() ?? null}
        sharePointDriveId={doc.sharePointDriveId}
        sharePointItemId={doc.sharePointItemId}
        sharePointWebUrl={doc.sharePointWebUrl}
        revisionHistory={revisionHistory}
        reviewHistory={reviewHistory}
      />
    </div>
  );
}
