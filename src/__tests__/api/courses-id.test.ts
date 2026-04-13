import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET, PATCH, DELETE } = await import("@/app/api/courses/[id]/route");

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/courses/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1");
    const res = await GET(req, params("c1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent course", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1");
    const res = await GET(req, params("c1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for unpublished course when employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Draft",
      status: "DRAFT",
      createdById: "other-user",
      createdBy: { name: "Other", email: "other@test.com" },
    });
    const req = new Request("http://localhost/api/courses/c1");
    const res = await GET(req, params("c1"));
    expect(res.status).toBe(404);
  });

  it("returns published course for employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Published",
      description: null,
      thumbnail: null,
      status: "PUBLISHED",
      createdById: "other",
      createdBy: { name: "Admin", email: "admin@test.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/courses/c1");
    const res = await GET(req, params("c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("published");
  });
});

describe("PATCH /api/courses/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when employee tries to edit", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      createdById: "other",
    });
    const req = new Request("http://localhost/api/courses/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hacked" }),
    });
    const res = await PATCH(req, params("c1"));
    expect(res.status).toBe(403);
  });

  it("allows admin to edit any course", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      createdById: "other-user",
    });
    mockPrisma.course.update.mockResolvedValue({
      id: "c1",
      title: "Updated",
      description: null,
      thumbnail: null,
      status: "PUBLISHED",
      createdBy: { name: "Admin", email: "admin@test.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/courses/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", status: "published" }),
    });
    const res = await PATCH(req, params("c1"));
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid status", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      createdById: "user-id",
    });
    const req = new Request("http://localhost/api/courses/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });
    const res = await PATCH(req, params("c1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/courses/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "manager" }));
    const req = new Request("http://localhost/api/courses/c1", {
      method: "DELETE",
    });
    const res = await DELETE(req, params("c1"));
    expect(res.status).toBe(403);
  });

  it("deletes course for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1" });
    mockPrisma.course.delete.mockResolvedValue({ id: "c1" });
    const req = new Request("http://localhost/api/courses/c1", {
      method: "DELETE",
    });
    const res = await DELETE(req, params("c1"));
    expect(res.status).toBe(200);
  });
});
