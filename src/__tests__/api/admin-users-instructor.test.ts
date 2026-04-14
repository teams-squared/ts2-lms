import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET: getUser } = await import("@/app/api/admin/users/[userId]/route");
const { GET: getCourses, POST: assignCourse } = await import(
  "@/app/api/admin/users/[userId]/courses/route"
);
const { DELETE: unassignCourse } = await import(
  "@/app/api/admin/users/[userId]/courses/[courseId]/route"
);

const makeUserParams = (userId: string) => ({
  params: Promise.resolve({ userId }),
});
const makeCoursesParams = (userId: string) => ({
  params: Promise.resolve({ userId }),
});
const makeAssignmentParams = (userId: string, courseId: string) => ({
  params: Promise.resolve({ userId, courseId }),
});

const makeRequest = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/admin/users/u1/courses", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const mockUser = {
  id: "u1",
  email: "inst@test.com",
  name: "Instructor",
  role: "INSTRUCTOR",
  createdAt: new Date("2024-01-01"),
  instructedCourses: [
    {
      assignedAt: new Date("2024-06-01"),
      course: { id: "c1", title: "Course 1", status: "PUBLISHED" },
    },
  ],
};

describe("GET /api/admin/users/[userId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "manager" }));
    const res = await getUser(new Request("http://localhost"), makeUserParams("u1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await getUser(new Request("http://localhost"), makeUserParams("u1"));
    expect(res.status).toBe(404);
  });

  it("returns user with instructor course assignments", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    const res = await getUser(new Request("http://localhost"), makeUserParams("u1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("instructor");
    expect(body.instructedCourses).toHaveLength(1);
    expect(body.instructedCourses[0].course.id).toBe("c1");
  });
});

describe("GET /api/admin/users/[userId]/courses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await getCourses(new Request("http://localhost"), makeCoursesParams("u1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await getCourses(new Request("http://localhost"), makeCoursesParams("u1"));
    expect(res.status).toBe(404);
  });

  it("returns list of assigned courses for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
    mockPrisma.courseInstructor.findMany.mockResolvedValue([
      {
        assignedAt: new Date("2024-06-01"),
        course: { id: "c1", title: "Course 1", status: "PUBLISHED" },
      },
    ]);
    const res = await getCourses(new Request("http://localhost"), makeCoursesParams("u1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("c1");
  });
});

describe("POST /api/admin/users/[userId]/courses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "manager" }));
    const res = await assignCourse(makeRequest({ courseId: "c1" }), makeCoursesParams("u1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await assignCourse(makeRequest({ courseId: "c1" }), makeCoursesParams("u1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when user is not an instructor", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", role: "EMPLOYEE" });
    const res = await assignCourse(makeRequest({ courseId: "c1" }), makeCoursesParams("u1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when courseId is missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", role: "INSTRUCTOR" });
    const res = await assignCourse(makeRequest({}), makeCoursesParams("u1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when course not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", role: "INSTRUCTOR" });
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const res = await assignCourse(makeRequest({ courseId: "c99" }), makeCoursesParams("u1"));
    expect(res.status).toBe(404);
  });

  it("assigns course successfully", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", role: "INSTRUCTOR" });
    mockPrisma.course.findUnique.mockResolvedValue({
      id: "c1",
      title: "Course 1",
      status: "PUBLISHED",
    });
    mockPrisma.courseInstructor.upsert.mockResolvedValue({
      courseId: "c1",
      userId: "u1",
      assignedAt: new Date("2024-06-01"),
    });
    const res = await assignCourse(makeRequest({ courseId: "c1" }), makeCoursesParams("u1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("c1");
  });
});

describe("DELETE /api/admin/users/[userId]/courses/[courseId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    const res = await unassignCourse(
      new Request("http://localhost", { method: "DELETE" }),
      makeAssignmentParams("u1", "c1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when assignment not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.courseInstructor.findUnique.mockResolvedValue(null);
    const res = await unassignCourse(
      new Request("http://localhost", { method: "DELETE" }),
      makeAssignmentParams("u1", "c1"),
    );
    expect(res.status).toBe(404);
  });

  it("deletes assignment successfully", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.courseInstructor.findUnique.mockResolvedValue({
      courseId: "c1",
      userId: "u1",
      assignedAt: new Date(),
    });
    mockPrisma.courseInstructor.delete.mockResolvedValue({});
    const res = await unassignCourse(
      new Request("http://localhost", { method: "DELETE" }),
      makeAssignmentParams("u1", "c1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });
});
