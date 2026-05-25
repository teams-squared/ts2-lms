"use client";

/**
 * Library-facing renderer for an IsoLibraryEntry.
 *
 * Renders the original SharePoint Word doc as an inline PDF (same
 * /api/sharepoint/files proxy used by the course-side PolicyDocViewer) plus
 * a slim Document Control header with a disclosure for revision/review
 * history. NO dwell gate, NO attestation, NO ack POST — library is
 * reference reading. Ack evidence continues to flow through the course
 * path.
 *
 * On mount, fires a single best-effort POST to /api/iso-library/[entryId]/
 * view to log the open for audit. Failure is silent — view logging must
 * never block reading.
 */

import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type {
  ReviewHistoryEntry,
  RevisionHistoryEntry,
} from "@/lib/policy-doc/types";

export interface IsoLibraryDocViewerProps {
  entryId: string;
  documentTitle: string;
  documentCode: string | null;
  sourceVersion: string;
  approver: string | null;
  approvedOn: string | null;
  lastReviewedOn: string | null;
  sharePointDriveId: string;
  sharePointItemId: string;
  sharePointWebUrl: string;
  revisionHistory: RevisionHistoryEntry[];
  reviewHistory: ReviewHistoryEntry[];
}

export function IsoLibraryDocViewer(props: IsoLibraryDocViewerProps) {
  const {
    entryId,
    documentTitle,
    documentCode,
    sourceVersion,
    approver,
    approvedOn,
    lastReviewedOn,
    sharePointDriveId,
    sharePointItemId,
    sharePointWebUrl,
    revisionHistory,
    reviewHistory,
  } = props;

  const [showDocControl, setShowDocControl] = useState(false);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [showReviewHistory, setShowReviewHistory] = useState(false);

  // Fire-and-forget view log. StrictMode-safe via ref guard so we don't
  // double-log in dev.
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    void fetch(`/api/iso-library/${entryId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      /* silent — view log is best-effort, never blocks reading */
    });
  }, [entryId]);

  // No `view=` directive — matches PolicyDocViewer behaviour so the browser
  // picks its native zoom instead of scaling up.
  const pdfSrc = `/api/sharepoint/files/${encodeURIComponent(sharePointDriveId)}/${encodeURIComponent(sharePointItemId)}?format=pdf#toolbar=1&navpanes=0`;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-foreground">
        {documentTitle}
      </h1>

      <section aria-label="Document control" className="mb-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-foreground">{documentTitle}</span>
            <span className="text-foreground-muted">
              {documentCode && (
                <>
                  {" · "}
                  <span className="font-mono text-xs">{documentCode}</span>
                </>
              )}
              {" · "}v{sourceVersion}
              {approver && (
                <span className="hidden sm:inline">
                  {" · "}Approved by {approver}
                </span>
              )}
            </span>
          </span>
          <a
            href={sharePointWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 text-xs text-primary hover:underline sm:inline"
          >
            Open in SharePoint ↗
          </a>
          <button
            type="button"
            onClick={() => setShowDocControl((s) => !s)}
            aria-expanded={showDocControl}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-sm"
          >
            {showDocControl ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Details
          </button>
        </div>

        {showDocControl && (
          <div className="mt-2 rounded-lg border border-border bg-surface p-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {documentCode && <Row label="Document code" value={documentCode} />}
              <Row label="Version" value={sourceVersion} />
              {approver && <Row label="Approved by" value={approver} />}
              {approvedOn && <Row label="Approved on" value={formatDate(approvedOn)} />}
              {lastReviewedOn && <Row label="Last reviewed" value={formatDate(lastReviewedOn)} />}
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={sharePointWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline sm:hidden"
              >
                Open original in SharePoint ↗
              </a>
              {revisionHistory.length > 0 && (
                <DisclosureButton
                  open={showRevisionHistory}
                  onClick={() => setShowRevisionHistory((s) => !s)}
                  label={`Revision history (${revisionHistory.length})`}
                />
              )}
              {reviewHistory.length > 0 && (
                <DisclosureButton
                  open={showReviewHistory}
                  onClick={() => setShowReviewHistory((s) => !s)}
                  label={`Review history (${reviewHistory.length})`}
                />
              )}
            </div>
            {showRevisionHistory && revisionHistory.length > 0 && (
              <RevisionTable rows={revisionHistory} />
            )}
            {showReviewHistory && reviewHistory.length > 0 && (
              <ReviewTable rows={reviewHistory} />
            )}
          </div>
        )}
      </section>

      <div
        className="mb-4 overflow-hidden rounded-lg border border-border bg-surface"
        style={{ height: "calc(100dvh - 9rem)", minHeight: "40rem" }}
      >
        <iframe
          src={pdfSrc}
          title={`${documentTitle} · v${sourceVersion}`}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-foreground-muted">{label}:</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function DisclosureButton({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
      aria-expanded={open}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function RevisionTable({ rows }: { rows: RevisionHistoryEntry[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="text-foreground-muted">
          <tr>
            <Th>Date</Th>
            <Th>Final v</Th>
            <Th>Description</Th>
            <Th>Approved by</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <Td>{r.date ?? "—"}</Td>
              <Td>{r.finalVersion ?? r.initialVersion ?? "—"}</Td>
              <Td>{r.description ?? "—"}</Td>
              <Td>{r.approvedBy ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewTable({ rows }: { rows: ReviewHistoryEntry[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="text-foreground-muted">
          <tr>
            <Th>Date</Th>
            <Th>Reviewed v</Th>
            <Th>Changes?</Th>
            <Th>Reviewed by</Th>
            <Th>Approved by</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <Td>{r.date ?? "—"}</Td>
              <Td>{r.reviewedVersion ?? "—"}</Td>
              <Td>{r.changesRequired ?? "—"}</Td>
              <Td>{r.reviewedBy ?? "—"}</Td>
              <Td>{r.approvedBy ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1.5 text-left font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 text-foreground">{children}</td>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
