import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/docs", () => ({ getDocContent: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn(), encode: vi.fn() }));

import { auth } from "@/lib/auth";
import { getDocContent } from "@/lib/docs";
import bcrypt from "bcryptjs";
import { getToken, encode } from "next-auth/jwt";
import { POST } from "@/app/api/docs/unlock/route";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeReq(body: unknown, { malformed = false } = {}) {
  const raw = malformed ? "not-json{{{" : JSON.stringify(body);
  return new NextRequest("http://localhost/api/docs/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
}

const USER_SESSION = { user: { email: "user@ts2.com", role: "employee" } };

// A realistic decoded JWT token (without unlockedDocs initially)
const BASE_TOKEN = {
  sub: "1",
  email: "user@ts2.com",
  role: "employee",
  iat: 1712345678,
  exp: 1712345678 + 30 * 24 * 60 * 60,
};

const PROTECTED_DOC = {
  meta: {
    title: "Secret Doc",
    description: "Shh",
    slug: "secret",
    category: "eng",
    minRole: "employee" as const,
    updatedAt: "",
    tags: [],
    order: 0,
    passwordProtected: true,
  },
  content: "# Secret",
  passwordHash: "$2b$10$somehash",
  quiz: null,
};

const UNPROTECTED_DOC = {
  ...PROTECTED_DOC,
  meta: { ...PROTECTED_DOC.meta, passwordProtected: false },
  passwordHash: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(USER_SESSION as never);
  vi.mocked(getDocContent).mockResolvedValue(PROTECTED_DOC);
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  vi.mocked(getToken).mockResolvedValue(BASE_TOKEN as never);
  vi.mocked(encode).mockResolvedValue("updated-session-jwt" as never);
});

// ── Auth check ────────────────────────────────────────────────────────────

describe("POST /api/docs/unlock — auth", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "pass" }));
    expect(res.status).toBe(401);
  });
});

// ── Input validation ───────────────────────────────────────────────────────

describe("POST /api/docs/unlock — input validation", () => {
  it("returns 400 on malformed JSON body", async () => {
    const res = await POST(makeReq(null, { malformed: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is missing", async () => {
    const res = await POST(makeReq({ slug: "secret", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug is missing", async () => {
    const res = await POST(makeReq({ category: "eng", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeReq({ category: "eng", slug: "secret" }));
    expect(res.status).toBe(400);
  });
});

// ── Path traversal protection ──────────────────────────────────────────────

describe("POST /api/docs/unlock — path traversal protection", () => {
  it("returns 400 when category contains path traversal sequences", async () => {
    const res = await POST(makeReq({ category: "../../etc", slug: "secret", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug contains path traversal sequences", async () => {
    const res = await POST(makeReq({ category: "eng", slug: "../auth", password: "pass" }));
    expect(res.status).toBe(400);
  });
});

// ── Role access check ──────────────────────────────────────────────────────

describe("POST /api/docs/unlock — role access", () => {
  it("returns 403 when user role is below the document minRole", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "e@ts2.com", role: "employee" } } as never);
    vi.mocked(getDocContent).mockResolvedValue({
      ...PROTECTED_DOC,
      meta: { ...PROTECTED_DOC.meta, minRole: "manager" as const },
    });
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    expect(res.status).toBe(403);
  });
});

// ── Document checks ────────────────────────────────────────────────────────

describe("POST /api/docs/unlock — document checks", () => {
  it("returns 404 when getDocContent returns null", async () => {
    vi.mocked(getDocContent).mockResolvedValue(null);
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "pass" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when doc has no passwordHash", async () => {
    vi.mocked(getDocContent).mockResolvedValue(UNPROTECTED_DOC);
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "pass" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when bcrypt.compare returns false", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "wrongpass" }));
    expect(res.status).toBe(401);
  });
});

// ── Session read failure ──────────────────────────────────────────────────

describe("POST /api/docs/unlock — session token failure", () => {
  it("returns 500 when getToken returns null", async () => {
    vi.mocked(getToken).mockResolvedValue(null);
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    expect(res.status).toBe(500);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────

describe("POST /api/docs/unlock — happy path", () => {
  it("returns 200 with { success: true }", async () => {
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("adds the doc key to unlockedDocs when encoding the updated JWT", async () => {
    await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    expect(vi.mocked(encode)).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({
          unlockedDocs: expect.arrayContaining(["eng/secret"]),
        }),
      })
    );
  });

  it("sets the session cookie to the newly encoded JWT value", async () => {
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("authjs.session-token=updated-session-jwt");
    expect(setCookie).toContain("HttpOnly");
  });

  it("sets SameSite=Lax on the updated session cookie", async () => {
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("preserves existing unlockedDocs when adding a new doc", async () => {
    vi.mocked(getToken).mockResolvedValue({
      ...BASE_TOKEN,
      unlockedDocs: ["eng/other-doc"],
    } as never);
    await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    expect(vi.mocked(encode)).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({
          unlockedDocs: expect.arrayContaining(["eng/other-doc", "eng/secret"]),
        }),
      })
    );
  });

  it("skips re-encoding when the doc is already unlocked", async () => {
    vi.mocked(getToken).mockResolvedValue({
      ...BASE_TOKEN,
      unlockedDocs: ["eng/secret"],
    } as never);
    const res = await POST(makeReq({ category: "eng", slug: "secret", password: "correct" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(encode)).not.toHaveBeenCalled();
  });
});
