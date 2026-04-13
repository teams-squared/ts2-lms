import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { PATCH, DELETE } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/route"
);

const makeParams = (id: string, moduleId: string) => ({
  params: Promise.resolve({ id, moduleId }),
});

describe("PATCH /api/courses/[id]/modules/[moduleId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, makeParams("c1", "m1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when course not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, makeParams("c1", "m1"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-owner employee", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-2", role: "employee" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, makeParams("c1", "m1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when module not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, makeParams("c1", "m1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when title is empty", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "PATCH",
      body: JSON.stringify({ title: "  " }),
    });
    const res = await PATCH(req, makeParams("c1", "m1"));
    expect(res.status).toBe(400);
  });

  it("updates module title for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "admin" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    mockPrisma.module.update.mockResolvedValue({
      id: "m1",
      title: "Updated Module",
      order: 1,
      courseId: "c1",
    });
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Module" }),
    });
    const res = await PATCH(req, makeParams("c1", "m1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated Module");
  });
});

describe("DELETE /api/courses/[id]/modules/[moduleId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("c1", "m1"));
    expect(res.status).toBe(401);
  });

  it("deletes module for course owner", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1", role: "manager" }));
    mockPrisma.course.findUnique.mockResolvedValue({ id: "c1", createdById: "user-1" });
    mockPrisma.module.findUnique.mockResolvedValue({ id: "m1", courseId: "c1" });
    mockPrisma.module.delete.mockResolvedValue({ id: "m1" });
    const req = new Request("http://localhost/api/courses/c1/modules/m1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("c1", "m1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
