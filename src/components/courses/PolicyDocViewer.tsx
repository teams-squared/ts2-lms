"use client";

/**
 * Learner-facing renderer for POLICY_DOC lessons.
 *
 * Renders the original ISO/policy Word document inline as a PDF (Microsoft
 * Graph converts the .docx → .pdf server-side; we stream it through the
 * SharePoint proxy with ?format=pdf). This preserves the Word doc's
 * formatting, tables, and images exactly as authored.
 *
 * The "Acknowledge" button (in LessonFooter) is gated by **two** signals:
 *   1. A minimum dwell of 6 minutes with the tab focused — long enough
 *      that the learner has actually had time to read a typical policy.
 *      Background tabs do not count.
 *   2. An explicit attestation checkbox — "I have read and understood
 *      [title] v[version]". This is what ISO auditors actually recognize.
 *
 * When both signals are satisfied, we fire `POLICY_ACK_EVENT` on the
 * window. LessonFooter listens for that event (unchanged from the old
 * scroll-sentinel flow) and enables its CTA.
 *
 * Surfaces:
 *   - Document Control panel (title, code, version, approver, dates,
 *     collapsed full revision history)
 *   - Stale acknowledgement banner — when the user previously acknowledged
 *     an older version
 *   - Inline PDF render of the current version
 *   - Attestation block (dwell progress + checkbox)
 */

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
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
  /** IDs needed to stream the PDF conversion through our SharePoint proxy. */
  sharePointDriveId: string;
  sharePointItemId: string;
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
  /** If the learner has already completed this lesson, we skip the dwell/
   *  attestation gate — the ack is already captured. */
  alreadyCompleted?: boolean;
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

/** Window event fired when dwell + attestation are both satisfied. The
 *  LessonFooter listens for this matching `lessonId` to enable its CTA. */
export const POLICY_ACK_EVENT = "policy-doc-acknowledgeable";

/** Minimum focused-tab dwell before the attestation checkbox is accepted. */
const DWELL_MS = 6 * 60 * 1000;

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
    sharePointDriveId,
    sharePointItemId,
    revisionHistory,
    reviewHistory,
    sharePointWebUrl,
    lastAcknowledgement,
    alreadyCompleted = false,
  } = props;

  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [showReviewHistory, setShowReviewHistory] = useState(false);
  // The full Document Control panel collapses by default to maximise the
  // vertical space the PDF gets. The slim header always shows the essentials
  // (code · version · approver). Learners who want the full detail can
  // expand it.
  const [showDocControl, setShowDocControl] = useState(false);

  // Dwell: accumulated ms of focused-tab time. We tick a 100ms interval
  // only while document.visibilityState === "visible", so background tabs
  // don't count.
  const [dwellMs, setDwellMs] = useState(alreadyCompleted ? DWELL_MS : 0);
  const [attested, setAttested] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (alreadyCompleted) return;
    if (dwellMs >= DWELL_MS) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (intervalId != null) return;
      intervalId = setInterval(() => {
        setDwellMs((ms) => Math.min(DWELL_MS, ms + 100));
      }, 100);
    }
    function stop() {
      if (intervalId == null) return;
      clearInterval(intervalId);
      intervalId = null;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dwellMs, alreadyCompleted]);

  // Fire the unlock event once dwell + attestation are both satisfied.
  const dwellDone = dwellMs >= DWELL_MS;
  const unlocked = alreadyCompleted || (dwellDone && attested);
  useEffect(() => {
    if (!unlocked || firedRef.current) return;
    firedRef.current = true;
    window.dispatchEvent(
      new CustomEvent(POLICY_ACK_EVENT, { detail: { lessonId } }),
    );
  }, [unlocked, lessonId]);

  const isStaleAck =
    lastAcknowledgement?.version != null &&
    lastAcknowledgement.version !== sourceVersion;

  // No `view=` directive — letting the browser pick its default keeps the
  // PDF at its native zoom instead of scaling it up to fill our wider
  // iframe (which made text huge and dropped lines-per-screen).
  const pdfSrc = `/api/sharepoint/files/${encodeURIComponent(sharePointDriveId)}/${encodeURIComponent(sharePointItemId)}?format=pdf#toolbar=1&navpanes=0`;

  const dwellPct = Math.round((dwellMs / DWELL_MS) * 100);
  const dwellSecondsRemaining = Math.max(0, Math.ceil((DWELL_MS - dwellMs) / 1000));
  const dwellMmSs = `${Math.floor(dwellSecondsRemaining / 60)
    .toString()
    .padStart(1, "0")}:${(dwellSecondsRemaining % 60).toString().padStart(2, "0")}`;

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

      {/* Document Control — slim header by default with a disclosure that
          expands the full metadata grid + revision/review history tables.
          The header is one line so it doesn't push the PDF down. */}
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

      {/* Reading-time timer — slim single-line bar with the rule explained
          via the title attribute (tooltip). Saves ~80px of vertical space
          vs the previous full-card banner so the PDF gets more lines. */}
      {!alreadyCompleted && !dwellDone && (
        <div
          className="mb-2 flex items-center gap-3 rounded-md border border-info/60 bg-info-subtle px-3 py-1.5"
          title="The acknowledgement option unlocks once you've had the page open for 6 minutes (background tabs don't count)."
        >
          <Clock className="h-4 w-4 flex-shrink-0 text-info" aria-hidden="true" />
          <span className="text-xs font-medium text-info">
            Reading time required
          </span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-info/15"
            role="progressbar"
            aria-valuenow={dwellPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Reading time progress"
          >
            <div
              className="h-full bg-info transition-[width] duration-100 ease-linear"
              style={{ width: `${dwellPct}%` }}
            />
          </div>
          <span
            className="shrink-0 font-mono text-sm font-semibold tabular-nums text-info"
            aria-hidden="true"
          >
            {dwellMmSs}
          </span>
        </div>
      )}

      {/* Inline PDF render of the original Word document. Height uses dvh
          so it scales with the viewport on mobile too — and now consumes
          the full available area minus the slim header bar + footer. */}
      <div
        className="mb-4 overflow-hidden rounded-lg border border-border bg-surface"
        style={{ height: "calc(100dvh - 9rem)", minHeight: "40rem" }}
      >
        <iframe
          src={pdfSrc}
          title={`${documentTitle} — v${sourceVersion}`}
          className="h-full w-full"
          // sandbox intentionally omitted: we serve the PDF from our own
          // origin via the SharePoint proxy, so same-origin rules apply.
        />
      </div>

      {/* Attestation block. Hidden entirely on re-visit of a completed
          lesson — the ack is already banked. */}
      {!alreadyCompleted && (
        <section
          aria-label="Acknowledgement"
          className="mb-6 rounded-lg border border-border bg-surface p-4"
        >
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-md p-2 -m-2 ${
              dwellDone ? "hover:bg-surface-muted" : "opacity-60 cursor-not-allowed"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed"
              checked={attested}
              disabled={!dwellDone}
              onChange={(e) => setAttested(e.target.checked)}
              aria-describedby={`attest-desc-${lessonId}`}
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">
                I have read and understood{" "}
                <span className="font-semibold">{documentTitle}</span> v{sourceVersion}.
              </span>
              <span
                id={`attest-desc-${lessonId}`}
                className="mt-1 block text-xs text-foreground-muted"
              >
                Your attestation, the version, and a content hash are stored
                as audit evidence.
              </span>
            </span>
          </label>

          {unlocked && (
            <p className="mt-3 flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Ready to acknowledge — use the button below.
            </p>
          )}
        </section>
      )}
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
