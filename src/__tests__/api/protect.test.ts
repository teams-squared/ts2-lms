import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks (must be hoisted before any imports of the module under test) ────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/roles", () => ({ hasAccess: vi.fn() }));
vi.mock("@/lib/sharepoint", () => ({
  fetchDocListFromSharePoint: vi.fn(),
  fetchDocContentFromSharePoint: vi.fn(),
  writeDocContentToSharePoint: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/lib/auth";
import { hasAccess } from "@/lib/roles";
import {
  fetchDocListFromSharePoint,
  fetchDocContentFromSharePoint,
  writeDocContentToSharePoint,
} from "@/lib/sharepoint";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { POST } from "@/app/api/docs/protect/route";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeReq(body: unknown, { malformed = false } = {}) {
  const raw = malformed ? "not-json{{{" : JSON.stringify(body);
  return new NextRequest("http://localhost/api/docs/protect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
}

const MANAGER_SESSION = { user: { email: "mgr@ts2.com", role: "manager" } };
const SAMPLE_MDX = `---\ntitle: My Doc\ndescription: A doc\n---\n\nBody text.`;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated manager, hasAccess passes
  vi.mocked(auth).mockResolvedValue(MANAGER_SESSION as never);
  vi.mocked(hasAccess).mockReturnValue(true);
  vi.mocked(fetchDocListFromSharePoint).mockResolvedValue(["my-doc.mdx"]);
  vi.mocked(fetchDocContentFromSharePoint).mockResolvedValue(SAMPLE_MDX);
  vi.mocked(writeDocContentToSharePoint).mockResolvedValue(undefined);
  vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$hashedpassword" as never);
});

// ── Auth checks ────────────────────────────────────────────────────────────

describe("POST /api/docs/protect — auth", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeReq({ category: "eng", slug: "my-doc" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user role is employee", async () => {
    vi.mocked(hasAccess).mockReturnValue(false);
    const res = await POST(makeReq({ category: "eng", slug: "my-doc" }));
    expect(res.status).toBe(403);
  });
});

// ── Input validation ───────────────────────────────────────────────────────

describe("POST /api/docs/protect — input validation", () => {
  it("returns 400 on malformed JSON body", async () => {
    const res = await POST(makeReq(null, { malformed: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is missing", async () => {
    const res = await POST(makeReq({ slug: "my-doc", password: "secret123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug is missing", async () => {
    const res = await POST(makeReq({ category: "eng", password: "secret123" }));
    expect(res.status).toBe(400);
  });
});

// ── SharePoint error handling ──────────────────────────────────────────────

describe("POST /api/docs/protect — SharePoint errors", () => {
  it("returns 502 when fetchDocListFromSharePoint throws", async () => {
    vi.mocked(fetchDocListFromSharePoint).mockRejectedValue(new Error("Network error"));
    const res = await POST(makeReq({ category: "eng", slug: "my-doc", password: "secret123" }));
    expect(res.status).toBe(502);
  });

  it("returns 404 when file is not in the list", async () => {
    vi.mocked(fetchDocListFromSharePoint).mockResolvedValue(["other-doc.mdx"]);
    const res = await POST(makeReq({ category: "eng", slug: "my-doc", password: "secret123" }));
    expect(res.status).toBe(404);
  });

  it("returns 502 when fetchDocContentFromSharePoint throws", async () => {
    vi.mocked(fetchDocContentFromSharePoint).mockRejectedValue(new Error("Forbidden"));
    const res = await POST(makeReq({ category: "eng", slug: "my-doc", password: "secret123" }));
    expect(res.status).toBe(502);
  });

  it("returns 502 when writeDocContentToSharePoint throws", async () => {
    vi.mocked(writeDocContentToSharePoint).mockRejectedValue(new Error("Write failed"));
    const res = await POST(makeReq({ category: "eng", slug: "my-doc", password: "secret123" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Write failed");
  });
});

// ── Happy path — set password ──────────────────────────────────────────────

describe("POST /api/docs/protect — set password", () => {
  it("calls bcrypt.hash with the trimmed password and cost 10", async () => {
    await POST(makeReq({ category: "eng", slug: "my-doc", password: "  secret123  " }));
    expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 10);
  });

  it("calls writeDocContentToSharePoint with content containing the hash", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$testhash" as never);
    await POST(makeReq({ category: "eng", slug: "my-doc", password: "secret123" }));
    const [, , written] = vi.mocked(writeDocContentToSharePoint).mock.calls[0];
    expect(written).toContain("$2b$10$testhash");
  });

  it("calls revalidatePath for the doc route", async () => {
    await POST(makeReq({ category: "eng", slug: "my-doc", password: "secret123" }));
    expect(revalidatePath).toHaveBeenCalledWith("/docs/eng/my-doc");
  });

  it("returns { success: true } on success", async () => {
    const res = await POST(makeReq({ category: "eng", slug: "my-doc", password: "secret123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });
});

// ── Happy path — remove password ───────────────────────────────────────────

describe("POST /api/docs/protect — remove password", () => {
  it("does NOT call bcrypt.hash when password is null", async () => {
    await POST(makeReq({ category: "eng", slug: "my-doc", password: null }));
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it("does NOT call bcrypt.hash when password is empty string", async () => {
    await POST(makeReq({ category: "eng", slug: "my-doc", password: "" }));
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it("writes content without a password field", async () => {
    const mdxWithPassword = `---\ntitle: My Doc\npassword: $2b$10$oldhash\n---\n\nBody.`;
    vi.mocked(fetchDocContentFromSharePoint).mockResolvedValue(mdxWithPassword);
    await POST(makeReq({ category: "eng", slug: "my-doc", password: null }));
    const [, , written] = vi.mocked(writeDocContentToSharePoint).mock.calls[0];
    expect(written).not.toContain("password:");
  });

  it("returns { success: true } on success", async () => {
    const res = await POST(makeReq({ category: "eng", slug: "my-doc", password: null }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });
});
