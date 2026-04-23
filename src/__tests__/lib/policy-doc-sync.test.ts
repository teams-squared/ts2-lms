/**
 * Tests the version-invalidation invariant of syncPolicyDoc:
 *   - eTag unchanged → no fetch, no write, no invalidation
 *   - eTag changed but version unchanged → write, no invalidation
 *   - version changed → write + clear acknowledgements on every
 *     LessonProgress for this lesson
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/posthog-server", () => ({ trackEvent: vi.fn() }));

const mockGetMetadata = vi.fn();
const mockGetContent = vi.fn();
vi.mock("@/lib/sharepoint", () => ({
  getDriveItemMetadata: (...args: unknown[]) => mockGetMetadata(...args),
  getDriveItemContent: (...args: unknown[]) => mockGetContent(...args),
}));

const mockParse = vi.fn();
vi.mock("@/lib/policy-doc/parser", () => ({
  parsePolicyDoc: (...args: unknown[]) => mockParse(...args),
}));

const { syncPolicyDoc } = await import("@/lib/policy-doc/sync");

const baseInput = {
  lessonId: "lesson-1",
  driveId: "drive-1",
  itemId: "item-1",
  actorUserId: "admin-1",
};

const fakeMeta = {
  id: "item-1",
  name: "TSPL-ISMS-POL-002 - Access Control Policy.docx",
  webUrl: "https://sp/.../doc.docx",
  lastModifiedDateTime: "2026-01-12T00:00:00Z",
  eTag: '"abc123,1"',
};

const fakeParsed = {
  renderMode: "PARSED" as const,
  documentTitle: "Access Control Policy",
  documentCode: "TSPL-ISMS-POL-002",
  sourceVersion: "1.0.0",
  approver: "Amresh",
  approvedOn: new Date("2025-11-15"),
  lastReviewedOn: new Date("2026-01-12"),
  reviewHistory: [],
  revisionHistory: [],
  renderedHTML: "<h1>Access Control Policy</h1>",
  renderedHTMLHash: "deadbeef",
  warnings: [],
};

describe("syncPolicyDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMetadata.mockResolvedValue(fakeMeta);
    const mockResponse = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) };
    mockGetContent.mockResolvedValue(mockResponse);
    mockParse.mockResolvedValue(fakeParsed);
  });

  it("noop when stored eTag equals SharePoint eTag", async () => {
    mockPrisma.policyDocLesson.findUnique.mockResolvedValue({
      id: "pd-1",
      sourceVersion: "1.0.0",
      sourceETag: "abc123,1", // matches normalized fakeMeta.eTag
    });

    const out = await syncPolicyDoc(baseInput);

    expect(out.status).toBe("noop");
    expect(mockGetContent).not.toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
    expect(mockPrisma.policyDocLesson.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.lessonProgress.updateMany).not.toHaveBeenCalled();
  });

  it("fetches + parses + writes when eTag differs but version is the same", async () => {
    mockPrisma.policyDocLesson.findUnique.mockResolvedValue({
      id: "pd-1",
      sourceVersion: "1.0.0",
      sourceETag: "old-etag",
    });
    mockPrisma.policyDocLesson.upsert.mockResolvedValue({
      id: "pd-1",
      sourceVersion: "1.0.0",
      sourceETag: "abc123,1",
      documentTitle: "Access Control Policy",
      documentCode: "TSPL-ISMS-POL-002",
    });

    const out = await syncPolicyDoc(baseInput);

    expect(out.status).toBe("synced");
    if (out.status !== "synced") return;
    expect(out.versionChanged).toBe(false);
    expect(out.invalidatedAcknowledgements).toBe(0);
    expect(mockPrisma.policyDocLesson.upsert).toHaveBeenCalledOnce();
    expect(mockPrisma.lessonProgress.updateMany).not.toHaveBeenCalled();
  });

  it("clears prior acknowledgements when sourceVersion changes", async () => {
    mockPrisma.policyDocLesson.findUnique.mockResolvedValue({
      id: "pd-1",
      sourceVersion: "0.9.0", // older — version bump incoming
      sourceETag: "old-etag",
    });
    mockPrisma.policyDocLesson.upsert.mockResolvedValue({
      id: "pd-1",
      sourceVersion: "1.0.0",
      sourceETag: "abc123,1",
      documentTitle: "Access Control Policy",
      documentCode: "TSPL-ISMS-POL-002",
    });
    mockPrisma.lessonProgress.updateMany.mockResolvedValue({ count: 7 });

    const out = await syncPolicyDoc(baseInput);

    expect(out.status).toBe("synced");
    if (out.status !== "synced") return;
    expect(out.versionChanged).toBe(true);
    expect(out.invalidatedAcknowledgements).toBe(7);
    expect(mockPrisma.lessonProgress.updateMany).toHaveBeenCalledWith({
      where: { lessonId: "lesson-1", acknowledgedAt: { not: null } },
      data: {
        completedAt: null,
        acknowledgedAt: null,
        acknowledgedVersion: null,
        acknowledgedETag: null,
        acknowledgedHash: null,
      },
    });
  });

  it("first-time bind (no existing row) writes but never invalidates", async () => {
    mockPrisma.policyDocLesson.findUnique.mockResolvedValue(null);
    mockPrisma.policyDocLesson.upsert.mockResolvedValue({
      id: "pd-new",
      sourceVersion: "1.0.0",
      sourceETag: "abc123,1",
      documentTitle: "Access Control Policy",
      documentCode: "TSPL-ISMS-POL-002",
    });

    const out = await syncPolicyDoc(baseInput);

    expect(out.status).toBe("synced");
    if (out.status !== "synced") return;
    expect(out.versionChanged).toBe(false);
    expect(mockPrisma.lessonProgress.updateMany).not.toHaveBeenCalled();
  });

  it("throws when SharePoint returns no eTag (cannot reliably sync)", async () => {
    mockGetMetadata.mockResolvedValue({ ...fakeMeta, eTag: undefined });
    await expect(syncPolicyDoc(baseInput)).rejects.toThrow(/no eTag/);
  });
});
