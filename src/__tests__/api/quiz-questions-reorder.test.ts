import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/questions/reorder/route"
);

const makeParams = (id: string, moduleId: string, lessonId: string) => ({
  params: Promise.resolve({ id, moduleId, lessonId }),
});

const makeRequest = (body: unknown) =>
  new Request(
    "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/reorder",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

const mockLesson = {
  id: "l1",
  moduleId: "m1",
  module: { courseId: "c1" },
};

const existingQuestions = [
  { id: "q1", lessonId: "l1", text: "Q1", order: 1, options: [] },
  { id: "q2", lessonId: "l1", text: "Q2", order: 2, options: [] },
  { id: "q3", lessonId: "l1", text: "Q3", order: 3, options: [] },
];

describe("POST .../quiz/questions/reorder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ orderedIds: ["q1", "q2"] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for employees", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(makeRequest({ orderedIds: ["q1", "q2"] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ orderedIds: ["q1"] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when orderedIds is missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(makeRequest({}), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when orderedIds is empty", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(makeRequest({ orderedIds: [] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when orderedIds don't match existing question IDs", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValueOnce([{ id: "q1" }, { id: "q2" }]);
    const res = await POST(
      makeRequest({ orderedIds: ["q1", "q99"] }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when orderedIds count differs from existing count", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValueOnce([{ id: "q1" }, { id: "q2" }, { id: "q3" }]);
    const res = await POST(
      makeRequest({ orderedIds: ["q1", "q2"] }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("reorders questions successfully for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany
      .mockResolvedValueOnce([{ id: "q1" }, { id: "q2" }, { id: "q3" }]) // validation query
      .mockResolvedValueOnce(existingQuestions); // final fetch
    mockPrisma.$transaction.mockResolvedValue([]);

    const res = await POST(
      makeRequest({ orderedIds: ["q3", "q1", "q2"] }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("reorders successfully for manager", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "manager" }));
    mockPrisma.course.findUnique.mockResolvedValue({ createdById: "test-user-id" });
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany
      .mockResolvedValueOnce([{ id: "q1" }, { id: "q2" }])
      .mockResolvedValueOnce(existingQuestions.slice(0, 2));
    mockPrisma.$transaction.mockResolvedValue([]);

    const res = await POST(
      makeRequest({ orderedIds: ["q2", "q1"] }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(200);
  });
});
