import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, POST } = await import("@/app/api/admin/sectors/route");

function postReq(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/sectors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 when not admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "mgr", role: "course_manager" }));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists sectors for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin", role: "admin" }));
    mockPrisma.sector.findMany.mockResolvedValue([{ id: "s1", key: "cybersecurity", label: "Cybersecurity" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].key).toBe("cybersecurity");
  });
});

describe("POST /api/admin/sectors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("403 when not admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "mgr", role: "course_manager" }));
    const res = await POST(postReq({ label: "HR" }));
    expect(res.status).toBe(403);
  });

  it("400 when label missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin", role: "admin" }));
    const res = await POST(postReq({ label: "  " }));
    expect(res.status).toBe(400);
  });

  it("derives a slug key from the label", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin", role: "admin" }));
    mockPrisma.sector.create.mockResolvedValue({ id: "s1", key: "cyber-security", label: "Cyber Security" });
    const res = await POST(postReq({ label: "Cyber Security" }));
    expect(res.status).toBe(201);
    expect(mockPrisma.sector.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: "cyber-security" }) }),
    );
  });

  it("409 on duplicate key (P2002)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin", role: "admin" }));
    mockPrisma.sector.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(postReq({ label: "Cybersecurity" }));
    expect(res.status).toBe(409);
  });
});
