import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, PATCH } = await import("@/app/api/admin/users/route");

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 when non-admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with user list for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "1",
        email: "admin@test.com",
        name: "Admin",
        role: "ADMIN",
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "2",
        email: "emp@test.com",
        name: "Employee",
        role: "EMPLOYEE",
        createdAt: new Date("2024-01-02"),
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(2);
    // Verify role mapping: Prisma ADMIN → app "admin"
    expect(body[0].role).toBe("admin");
    expect(body[1].role).toBe("employee");
  });
});

describe("PATCH /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when non-admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "manager" }));
    const req = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "1", role: "manager" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing userId", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    const req = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "manager" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    const req = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "1", role: "superuser" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("accepts instructor as a valid role", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.update.mockResolvedValue({
      id: "1",
      email: "user@test.com",
      name: "User",
      role: "INSTRUCTOR",
      createdAt: new Date("2024-01-01"),
    });
    const req = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "1", role: "instructor" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("instructor");
  });

  it("returns 200 with updated user", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.update.mockResolvedValue({
      id: "1",
      email: "user@test.com",
      name: "User",
      role: "MANAGER",
      createdAt: new Date("2024-01-01"),
    });

    const req = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "1", role: "manager" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.role).toBe("manager"); // Prisma MANAGER → app "manager"
    expect(body.id).toBe("1");
  });
});
