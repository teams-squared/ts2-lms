import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import("@/app/api/internal-docs/route");
const { GET, PATCH, DELETE } = await import("@/app/api/internal-docs/[id]/route");

function jsonReq(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  title: "Runbook",
  type: "text",
  content: "# Hello",
  requirements: [{ sectorId: "sec-cyber", tier: 1 }],
};

describe("POST /api/internal-docs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(401);
  });

  it("400 when title missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    const res = await POST(jsonReq({ ...validBody, title: "  " }));
    expect(res.status).toBe(400);
  });

  it("400 when type unsupported (quiz/policy_doc not allowed)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    const res = await POST(jsonReq({ ...validBody, type: "quiz" }));
    expect(res.status).toBe(400);
  });

  it("400 when no requirements (never world-readable)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    const res = await POST(jsonReq({ ...validBody, requirements: [] }));
    expect(res.status).toBe(400);
  });

  it("404 when a sector does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.sector.count.mockResolvedValue(0);
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(404);
  });

  it("403 when author lacks clearance for a stamped requirement", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.sector.count.mockResolvedValue(1);
    // author holds cyber tier 3 — cannot stamp tier 1 (more protected)
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 3 }]);
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(403);
  });

  it("201 when author satisfies the requirement", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.sector.count.mockResolvedValue(1);
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 0 }]);
    mockPrisma.internalDoc.create.mockResolvedValue({ id: "doc-1" });
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("doc-1");
  });

  it("201 for admin without clearance checks", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin", role: "admin" }));
    mockPrisma.sector.count.mockResolvedValue(1);
    mockPrisma.internalDoc.create.mockResolvedValue({ id: "doc-2" });
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(201);
    expect(mockPrisma.userClearance.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/internal-docs/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404 when the viewer is not cleared (don't reveal existence)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.internalDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      clearanceRequirements: [{ sectorId: "sec-cyber", tier: 1 }],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 3 }]);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("200 when cleared", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.internalDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      clearanceRequirements: [{ sectorId: "sec-cyber", tier: 2 }],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 1 }]);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(200);
  });

  it("200 for admin regardless of clearance", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin", role: "admin" }));
    mockPrisma.internalDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      clearanceRequirements: [{ sectorId: "sec-cyber", tier: 0 }],
    });
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.userClearance.findMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal-docs/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 when author can't satisfy the doc", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.internalDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      clearanceRequirements: [{ sectorId: "sec-cyber", tier: 0 }],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 2 }]);
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(403);
    expect(mockPrisma.internalDoc.delete).not.toHaveBeenCalled();
  });

  it("deletes for a satisfying author", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.internalDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      clearanceRequirements: [{ sectorId: "sec-cyber", tier: 2 }],
    });
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 1 }]);
    mockPrisma.internalDoc.delete.mockResolvedValue({});
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.internalDoc.delete).toHaveBeenCalled();
  });
});

describe("PATCH /api/internal-docs/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 when author can't satisfy the existing audience", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.internalDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      content: "old",
      category: null,
      clearanceRequirements: [{ sectorId: "sec-cyber", tier: 0 }],
    });
    mockPrisma.sector.count.mockResolvedValue(1);
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 2 }]);
    const res = await PATCH(jsonReq(validBody), { params: Promise.resolve({ id: "doc-1" }) });
    expect(res.status).toBe(403);
  });

  it("updates when author satisfies both old and new requirements", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "u1", role: "employee" }));
    mockPrisma.internalDoc.findUnique.mockResolvedValue({
      id: "doc-1",
      content: "old",
      category: null,
      clearanceRequirements: [{ sectorId: "sec-cyber", tier: 2 }],
    });
    mockPrisma.sector.count.mockResolvedValue(1);
    mockPrisma.userClearance.findMany.mockResolvedValue([{ sectorId: "sec-cyber", tier: 1 }]);
    const res = await PATCH(jsonReq(validBody), { params: Promise.resolve({ id: "doc-1" }) });
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
