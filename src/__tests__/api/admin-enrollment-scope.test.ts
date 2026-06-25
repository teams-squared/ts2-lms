import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/xp", () => ({
  awardXp: vi.fn().mockResolvedValue({ newAchievements: [] }),
}));
vi.mock("@/lib/posthog-server", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendCourseCompletionEmail: vi.fn() }));

const { PUT } = await import(
  "@/app/api/admin/users/[userId]/enrollments/[courseId]/modules/route"
);

const makeReq = (body: unknown) =>
  new Request("http://localhost/api/admin/users/u1/enrollments/c1/modules", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const callPut = (body: unknown, userId = "u1", courseId = "c1") =>
  PUT(makeReq(body), { params: Promise.resolve({ userId, courseId }) });

describe("PUT /api/admin/users/[userId]/enrollments/[courseId]/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: validation passes, enrollment exists, completion checks no-op.
    mockPrisma.module.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    mockPrisma.lesson.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(
      async (cb: (t: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
  });

  it("returns 403 for employee role", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await callPut({ moduleIds: ["m1"] });
    expect(res.status).toBe(403);
  });

  it("returns 400 when moduleIds is not an array", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    const res = await callPut({});
    expect(res.status).toBe(400);
  });

  it("returns 404 when the enrollment does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-1", role: "admin" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await callPut({ moduleIds: ["m1"] });
    expect(res.status).toBe(404);
  });

  it("returns 400 when a module is outside the course", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-1", role: "admin" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      course: { title: "Course One" },
    });
    mockPrisma.module.findMany.mockResolvedValue([{ id: "m1" }]); // mX invalid
    const res = await callPut({ moduleIds: ["m1", "mX"] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid).toEqual(["mX"]);
  });

  it("replaces the scope with the given subset", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-1", role: "admin" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      course: { title: "Course One" },
    });

    const res = await callPut({ moduleIds: ["m1", "m2"] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      updated: true,
      wholeCourse: false,
      scopedModuleIds: ["m1", "m2"],
    });
    // Old rows cleared, new rows written.
    expect(mockPrisma.enrollmentModule.deleteMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1" },
    });
    expect(mockPrisma.enrollmentModule.createMany).toHaveBeenCalledWith({
      data: [
        { enrollmentId: "e1", moduleId: "m1" },
        { enrollmentId: "e1", moduleId: "m2" },
      ],
    });
  });

  it("promotes to whole course when moduleIds is empty (deletes rows, no createMany)", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "admin-1", role: "admin" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      course: { title: "Course One" },
    });

    const res = await callPut({ moduleIds: [] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wholeCourse).toBe(true);
    expect(mockPrisma.enrollmentModule.deleteMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1" },
    });
    expect(mockPrisma.enrollmentModule.createMany).not.toHaveBeenCalled();
  });
});
