"use client";

/**
 * Learner-facing renderer for POLICY_DOC lessons.
 *
 * Surfaces:
 *   - Document Control panel (title, code, version, approver, dates,
 *     collapsed full revision history)
 *   - Stale acknowledgement banner — when the user previously acknowledged
 *     an older version
 *   - The sanitized HTML body (already cross-ref linked server-side)
 *   - Sentinel-based scroll-to-bottom signal — fires a window CustomEvent
 *     so LessonFooter can enable its Mark-complete button only after the
 *     learner has actually reached the bottom of the document
 */

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { LessonTitleHeader } from "./LessonTitleHeader";

export interface PolicyDocViewProps {
  lessonId: string;
  lessonTitle: string;
  documentTitle: string;
  documentCode: string | null;
  sourceVersion: string;
  approver: string | null;
  approvedOn: string | null; // ISO
  lastReviewedOn: string | null; // ISO
  renderedHTML: string;
  /** Pulled from RevisionHistoryEntry[]; parsed JSON shape. */
  revisionHistory: RevisionRow[];
  /** Pulled from ReviewHistoryEntry[]. */
  reviewHistory: ReviewRow[];
  /** SP "Open in" link for the original Word doc. */
  sharePointWebUrl: string;
  /** Latest acknowledgement (if any) by the current learner. Used to detect
   *  stale acknowledgements after a version bump. */
  lastAcknowledgement: {
    version: string | null;
    acknowledgedAt: string | null;
  } | null;
}

interface RevisionRow {
  date: string | null;
  initialVersion: string | null;
  description: string | null;
  pages: string | null;
  proposedBy: string | null;
  changedBy: string | null;
  finalVersion: string | null;
  approvedBy: string | null;
}

interface ReviewRow {
  date: string | null;
  reviewedVersion: string | null;
  changesRequired: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
}

/** Window event fired when the learner scrolls past the sentinel. The
 *  LessonFooter listens for this matching `lessonId` to enable its CTA. */
export const POLICY_ACK_EVENT = "policy-doc-acknowledgeable";

export function PolicyDocViewer(props: PolicyDocViewProps) {
  const {
    lessonId,
    lessonTitle,
    documentTitle,
    documentCode,
    sourceVersion,
    approver,
    approvedOn,
    lastReviewedOn,
    renderedHTML,
    revisionHistory,
    reviewHistory,
    sharePointWebUrl,
    lastAcknowledgement,
  } = props;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const firedRef = useRef(false);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [showReviewHistory, setShowReviewHistory] = useState(false);

  // Scroll-to-bottom gate. Once the sentinel has crossed the viewport once,
  // we fire the event and stop watching — the footer button stays enabled
  // even if the user scrolls back up.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            window.dispatchEvent(
              new CustomEvent(POLICY_ACK_EVENT, { detail: { lessonId } }),
            );
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lessonId]);

  const isStaleAck =
    lastAcknowledgement?.version != null &&
    lastAcknowledgement.version !== sourceVersion;

  return (
    <div>
      <LessonTitleHeader
        title={lessonTitle}
        type="policy_doc"
        formatLabel={documentCode ? `${documentCode} · v${sourceVersion}` : `Policy doc · v${sourceVersion}`}
      />

      {isStaleAck && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/60 bg-warning-subtle px-5 py-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-warning">
              Policy updated since your last acknowledgement
            </p>
            <p className="mt-0.5 text-foreground-muted">
              You acknowledged v{lastAcknowledgement.version}. The current
              version is v{sourceVersion}. Please re-read and acknowledge.
            </p>
          </div>
        </div>
      )}

      {/* Document Control panel — always-visible header summary, with the
          full revision/review history hidden behind disclosure toggles. */}
      <section
        aria-label="Document control"
        className="mb-6 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{documentTitle}</p>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {documentCode && (
                <Row label="Document code" value={documentCode} />
              )}
              <Row label="Version" value={sourceVersion} />
              {approver && <Row label="Approved by" value={approver} />}
              {approvedOn && (
                <Row label="Approved on" value={formatDate(approvedOn)} />
              )}
              {lastReviewedOn && (
                <Row label="Last reviewed" value={formatDate(lastReviewedOn)} />
              )}
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={sharePointWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
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
        </div>
      </section>

      {/* Sanitized policy body. Class hooks (.policy-h1/2/3, .policy-xref)
          come straight from the parser. Heading + paragraph + list styling
          is applied via the prose-ish ruleset below. */}
      <article
        className="policy-prose"
        dangerouslySetInnerHTML={{ __html: renderedHTML }}
      />

      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <p className="mt-6 text-xs text-foreground-subtle">
        By acknowledging, you confirm you&apos;ve read and understood the
        current version of this policy. Your acknowledgement, the version
        identifier, and a content hash are stored as audit evidence.
      </p>

      {/* Inline minimal styles for the rendered body — keeps the typography
          consistent with the rest of the LMS without adding a global CSS
          dependency. */}
      <style jsx global>{`
        .policy-prose .policy-h1 {
          font-family: var(--font-display, inherit);
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.5rem 0 1rem;
          color: var(--color-foreground, #111);
        }
        .policy-prose .policy-h2 {
          font-family: var(--font-display, inherit);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1.5rem 0 0.75rem;
          color: var(--color-foreground, #111);
        }
        .policy-prose .policy-h3 {
          font-size: 1rem;
          font-weight: 600;
          margin: 1.25rem 0 0.5rem;
          color: var(--color-foreground, #111);
        }
        .policy-prose p {
          font-size: 1rem;
          line-height: 1.7;
          margin-bottom: 1rem;
        }
        .policy-prose ul,
        .policy-prose ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .policy-prose ul { list-style: disc; }
        .policy-prose ol { list-style: decimal; }
        .policy-prose li {
          line-height: 1.7;
          margin-bottom: 0.25rem;
        }
        .policy-prose a.policy-xref {
          color: var(--color-primary, #2563eb);
          text-decoration: underline;
        }
      `}</style>
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

function RevisionTable({ rows }: { rows: RevisionRow[] }) {
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

function ReviewTable({ rows }: { rows: ReviewRow[] }) {
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
