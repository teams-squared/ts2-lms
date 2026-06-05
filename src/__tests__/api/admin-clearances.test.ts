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
      mockSession({ id: "mgr-id", role: "course_manager" }),
    );
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns the user's sector grants for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    const grantedAt = new Date();
    mockPrisma.userClearance.findMany.mockResolvedValue([
      {
        sectorId: "sec-cyber",
        tier: 1,
        grantedAt,
        sector: { key: "cybersecurity", label: "Cybersecurity" },
      },
    ]);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ userId: "u1" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].sectorId).toBe("sec-cyber");
    expect(body[0].tier).toBe(1);
    expect(body[0].sector.label).toBe("Cybersecurity");
  });
});

describe("POST /api/admin/users/[userId]/clearances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(
      mockSession({ id: "mgr-id", role: "course_manager" }),
    );
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ sectorId: "sec-cyber", tier: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when sectorId is missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ tier: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when tier is negative or non-integer", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ sectorId: "sec-cyber", tier: -1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.sector.findUnique.mockResolvedValue({ id: "sec-cyber" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ sectorId: "sec-cyber", tier: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when sector not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
    mockPrisma.sector.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ sectorId: "sec-missing", tier: 1 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(404);
  });

  it("upserts the grant and returns 201", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-id", role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
    mockPrisma.sector.findUnique.mockResolvedValue({ id: "sec-cyber" });
    mockPrisma.userClearance.upsert.mockResolvedValue({
      sectorId: "sec-cyber",
      tier: 2,
      grantedAt: new Date(),
      sector: { key: "cybersecurity", label: "Cybersecurity" },
    });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ sectorId: "sec-cyber", tier: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.sectorId).toBe("sec-cyber");
    expect(body.tier).toBe(2);
    expect(mockPrisma.userClearance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_sectorId: { userId: "u1", sectorId: "sec-cyber" } },
        create: { userId: "u1", sectorId: "sec-cyber", tier: 2 },
        update: { tier: 2 },
      }),
    );
  });
});
