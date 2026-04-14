import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, POST } = await import(
  "@/app/api/admin/users/[userId]/clearances/route"
);

describe("GET /api/admin/users/[userId]/clearances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "mgr-id", role: "manager" }),
    );
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns list of clearances for admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    const grantedAt = new Date();
    mockPrisma.userClearance.findMany.mockResolvedValue([
      { id: "uc1", clearance: "secret", userId: "u1", grantedAt },
    ]);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("uc1");
    expect(body[0].clearance).toBe("secret");
  });
});

describe("POST /api/admin/users/[userId]/clearances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "mgr-id", role: "manager" }),
    );
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ clearance: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when clearance is missing", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ clearance: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(404);
  });

  it("creates clearance via upsert and returns 201", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "User One",
    });
    mockPrisma.userClearance.upsert.mockResolvedValue({
      id: "uc-new",
      userId: "u1",
      clearance: "secret",
      grantedAt: new Date(),
    });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ clearance: "secret" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBe("uc-new");
    expect(body.clearance).toBe("secret");
  });

  it("normalizes clearance to trimmed lowercase", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "admin-id", role: "admin" }),
    );
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "User One",
    });
    mockPrisma.userClearance.upsert.mockResolvedValue({
      id: "uc-new",
      userId: "u1",
      clearance: "secret",
      grantedAt: new Date(),
    });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ clearance: "  SECRET  " }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(201);

    expect(mockPrisma.userClearance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_clearance: { userId: "u1", clearance: "secret" } },
        create: { userId: "u1", clearance: "secret" },
        update: {},
      }),
    );
  });
});
