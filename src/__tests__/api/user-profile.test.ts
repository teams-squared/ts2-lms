import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { PATCH } = await import("@/app/api/user/profile/route");

describe("PATCH /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "Alice" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty name", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    const req = new Request("http://localhost/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for whitespace-only name", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    const req = new Request("http://localhost/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "   " }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    const req = new Request("http://localhost/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("updates and returns user with trimmed name", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "employee" }));
    mockPrisma.user.update.mockResolvedValue({
      id: "u1",
      name: "Alice",
      email: "a@t.com",
      role: "EMPLOYEE",
    });

    const req = new Request("http://localhost/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "  Alice  " }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      id: "u1",
      name: "Alice",
      email: "a@t.com",
      role: "EMPLOYEE",
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Alice" },
      select: { id: true, name: true, email: true, role: true },
    });
  });
});
