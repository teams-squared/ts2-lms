import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sharepoint", () => ({
  ensureCategoryFolder: vi.fn(),
  writeDocContentToSharePoint: vi.fn(),
  deleteDocFromSharePoint: vi.fn(),
  fetchDocContentFromSharePoint: vi.fn(),
  moveDocInSharePoint: vi.fn(),
}));

import { auth } from "@/lib/auth";
import {
  ensureCategoryFolder,
  writeDocContentToSharePoint,
  deleteDocFromSharePoint,
  fetchDocContentFromSharePoint,
  moveDocInSharePoint,
} from "@/lib/sharepoint";
import { POST, DELETE } from "@/app/api/admin/docs/route";
import { PATCH } from "@/app/api/admin/docs/move/route";

// ── Helpers ───────────────────────────────────────────────────────────────

const ADMIN_SESSION = { user: { email: "admin@ts2.com", role: "admin" } };
const MANAGER_SESSION = { user: { email: "mgr@ts2.com", role: "manager" } };

const VALID_MDX = `---
title: My Document
description: A test document
minRole: employee
updatedAt: "2026-01-01"
---

# My Document

Some content.
`;

function makeMdxFile(name: string, content = VALID_MDX) {
  return new File([content], name, { type: "text/plain" });
}

function makeUploadReq(file: File, category: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", category);
  return new NextRequest("http://localhost/api/admin/docs", {
    method: "POST",
    body: fd,
  });
}

function makeDeleteReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/docs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMoveReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/docs/move", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as never);
  vi.mocked(ensureCategoryFolder).mockResolvedValue(undefined);
  vi.mocked(writeDocContentToSharePoint).mockResolvedValue(undefined);
  vi.mocked(deleteDocFromSharePoint).mockResolvedValue(undefined);
  vi.mocked(moveDocInSharePoint).mockResolvedValue(undefined);
  vi.mocked(fetchDocContentFromSharePoint).mockResolvedValue(VALID_MDX);
});

// ── POST /api/admin/docs ────────────────────────────────────────────────────

describe("POST /api/admin/docs — auth", () => {
  it("returns 403 for non-admin (manager)", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER_SESSION as never);
    const res = await POST(makeUploadReq(makeMdxFile("doc.mdx"), "engineering"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makeUploadReq(makeMdxFile("doc.mdx"), "engineering"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/admin/docs — validation", () => {
  it("returns 400 when file extension is not .mdx", async () => {
    const res = await POST(makeUploadReq(makeMdxFile("doc.txt"), "engineering"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining(".mdx") });
  });

  it("returns 400 when category contains path traversal characters", async () => {
    const res = await POST(makeUploadReq(makeMdxFile("doc.mdx"), "../secrets"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when frontmatter is missing title", async () => {
    const noTitle = `---\ndescription: A doc\n---\n\nContent.`;
    const res = await POST(makeUploadReq(makeMdxFile("doc.mdx", noTitle), "engineering"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("title") });
  });

  it("returns 400 when frontmatter is missing description", async () => {
    const noDesc = `---\ntitle: A doc\n---\n\nContent.`;
    const res = await POST(makeUploadReq(makeMdxFile("doc.mdx", noDesc), "engineering"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("description") });
  });
});

describe("POST /api/admin/docs — success", () => {
  it("returns 201 with slug and category", async () => {
    const res = await POST(makeUploadReq(makeMdxFile("my-guide.mdx"), "engineering"));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ slug: "my-guide", category: "engineering" });
  });

  it("calls ensureCategoryFolder before writing", async () => {
    await POST(makeUploadReq(makeMdxFile("my-guide.mdx"), "engineering"));
    expect(vi.mocked(ensureCategoryFolder)).toHaveBeenCalledWith("engineering");
    expect(vi.mocked(writeDocContentToSharePoint)).toHaveBeenCalledWith(
      "engineering",
      "my-guide.mdx",
      expect.any(String)
    );
    // Folder must be ensured before the write
    const ensureOrder = vi.mocked(ensureCategoryFolder).mock.invocationCallOrder[0];
    const writeOrder = vi.mocked(writeDocContentToSharePoint).mock.invocationCallOrder[0];
    expect(ensureOrder).toBeLessThan(writeOrder);
  });

  it("returns 502 when SharePoint write fails", async () => {
    vi.mocked(writeDocContentToSharePoint).mockRejectedValueOnce(new Error("Network error"));
    const res = await POST(makeUploadReq(makeMdxFile("my-guide.mdx"), "engineering"));
    expect(res.status).toBe(502);
  });
});

// ── DELETE /api/admin/docs ──────────────────────────────────────────────────

describe("DELETE /api/admin/docs — auth", () => {
  it("returns 403 for non-admin", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER_SESSION as never);
    const res = await DELETE(makeDeleteReq({ category: "engineering", slug: "my-doc" }));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/docs — validation", () => {
  it("returns 400 when category is missing", async () => {
    const res = await DELETE(makeDeleteReq({ slug: "my-doc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug contains path traversal characters", async () => {
    const res = await DELETE(makeDeleteReq({ category: "engineering", slug: "../secrets" }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/docs — success", () => {
  it("returns 204 on successful delete", async () => {
    const res = await DELETE(makeDeleteReq({ category: "engineering", slug: "my-doc" }));
    expect(res.status).toBe(204);
  });

  it("calls deleteDocFromSharePoint with correct args", async () => {
    await DELETE(makeDeleteReq({ category: "engineering", slug: "my-doc" }));
    expect(vi.mocked(deleteDocFromSharePoint)).toHaveBeenCalledWith("engineering", "my-doc.mdx");
  });

  it("returns 502 when SharePoint delete fails", async () => {
    vi.mocked(deleteDocFromSharePoint).mockRejectedValueOnce(new Error("Not found"));
    const res = await DELETE(makeDeleteReq({ category: "engineering", slug: "my-doc" }));
    expect(res.status).toBe(502);
  });
});

// ── PATCH /api/admin/docs/move ──────────────────────────────────────────────

describe("PATCH /api/admin/docs/move — auth", () => {
  it("returns 403 for non-admin", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER_SESSION as never);
    const res = await PATCH(
      makeMoveReq({ fromCategory: "a", fromSlug: "doc", toCategory: "b", toSlug: "doc" })
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/docs/move — validation", () => {
  it("returns 400 when a required field is missing", async () => {
    const res = await PATCH(makeMoveReq({ fromCategory: "a", fromSlug: "doc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for path traversal in any segment", async () => {
    const res = await PATCH(
      makeMoveReq({ fromCategory: "../etc", fromSlug: "doc", toCategory: "b", toSlug: "doc" })
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/docs/move — move to different category", () => {
  it("calls moveDocInSharePoint with correct file names", async () => {
    const res = await PATCH(
      makeMoveReq({ fromCategory: "engineering", fromSlug: "setup", toCategory: "hr", toSlug: "setup" })
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(moveDocInSharePoint)).toHaveBeenCalledWith(
      "engineering", "setup.mdx", "hr", "setup.mdx"
    );
  });
});

describe("PATCH /api/admin/docs/move — reorder within category", () => {
  it("updates frontmatter order and writes back when same doc + order provided", async () => {
    const res = await PATCH(
      makeMoveReq({ fromCategory: "engineering", fromSlug: "setup", toCategory: "engineering", toSlug: "setup", order: 5 })
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(moveDocInSharePoint)).not.toHaveBeenCalled();
    expect(vi.mocked(writeDocContentToSharePoint)).toHaveBeenCalledWith(
      "engineering",
      "setup.mdx",
      expect.stringContaining("order: 5")
    );
  });
});
