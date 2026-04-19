import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import("@/app/api/courses/[id]/enroll/route");

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/courses/[id]/enroll (self-enrollment disabled)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for employee with descriptive message", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Self-enrollment is disabled");
  });

  it("returns 403 for course_manager", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "course_manager" }));
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for admin (use /api/admin/enrollments instead)", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    const req = new Request("http://localhost/api/courses/c1/enroll", { method: "POST" });
    const res = await POST(req, makeParams("c1"));
    expect(res.status).toBe(403);
  });
});
