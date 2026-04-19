import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockAuth, mockSession } from "../mocks/auth";
import type { Role } from "@/lib/types";

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { hasAccess, requireAuth, requireRole } = await import("@/lib/roles");

describe("hasAccess", () => {
  const cases: [Role, Role, boolean][] = [
    // userRole, requiredRole, expected
    ["admin",    "admin",    true],
    ["admin",    "course_manager",  true],
    ["admin",    "employee", true],
    ["course_manager",  "admin",    false],
    ["course_manager",  "course_manager",  true],
    ["course_manager",  "employee", true],
    ["employee", "admin",    false],
    ["employee", "course_manager",  false],
    ["employee", "employee", true],
  ];

  it.each(cases)(
    "hasAccess(%s, %s) → %s",
    (userRole, requiredRole, expected) => {
      expect(hasAccess(userRole, requiredRole)).toBe(expected);
    }
  );
});

describe("requireAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: { id: undefined, role: "employee" } });
    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns AuthResult when authenticated", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "course_manager" }));
    const result = await requireAuth();
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({ userId: "u1", role: "course_manager" });
  });
});

describe("requireRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireRole("admin");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 403 when role is insufficient", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    const result = await requireRole("course_manager");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns AuthResult when role matches exactly", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "course_manager" }));
    const result = await requireRole("course_manager");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({ userId: "u1", role: "course_manager" });
  });

  it("returns AuthResult when role exceeds requirement (admin >= manager)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "admin" }));
    const result = await requireRole("course_manager");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toMatchObject({ userId: "u1", role: "admin" });
  });
});
