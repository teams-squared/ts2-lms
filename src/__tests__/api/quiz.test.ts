import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { GET } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/route"
);

const makeParams = (id: string, moduleId: string, lessonId: string) => ({
  params: Promise.resolve({ id, moduleId, lessonId }),
});

const makeRequest = () =>
  new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz");

const mockLesson = {
  id: "l1",
  moduleId: "m1",
  content: JSON.stringify({ passingScore: 70 }),
  module: { courseId: "c1" },
};

const mockQuestions = [
  {
    id: "q1",
    text: "What is 2+2?",
    order: 1,
    options: [
      { id: "o1", text: "3", isCorrect: false, order: 1 },
      { id: "o2", text: "4", isCorrect: true, order: 2 },
    ],
  },
];

describe("GET .../lessons/[lessonId]/quiz", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when lesson does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when lesson belongs to a different module", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue({
      ...mockLesson,
      moduleId: "other-module",
    });
    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns empty questions array when no questions exist", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue([]);
    mockPrisma.quizAttempt.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toEqual([]);
    expect(body.passingScore).toBe(70);
    expect(body.bestAttempt).toBeNull();
  });

  it("returns questions with options for employee (isCorrect omitted)", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(1);
    // isCorrect should not be in options for employees
    expect(body.questions[0].options[0]).not.toHaveProperty("isCorrect");
    expect(body.questions[0].options[1]).not.toHaveProperty("isCorrect");
  });

  it("returns questions with isCorrect for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions[0].options[0]).toHaveProperty("isCorrect", false);
    expect(body.questions[0].options[1]).toHaveProperty("isCorrect", true);
  });

  it("returns questions with isCorrect for manager", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "manager" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions[0].options[1]).toHaveProperty("isCorrect", true);
  });

  it("returns best attempt when user has previous attempts", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.findMany.mockResolvedValue([
      {
        id: "att1",
        score: 0,
        totalQuestions: 1,
        passed: false,
        createdAt: new Date("2026-04-01"),
      },
      {
        id: "att2",
        score: 1,
        totalQuestions: 1,
        passed: true,
        createdAt: new Date("2026-04-02"),
      },
    ]);

    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bestAttempt).not.toBeNull();
    expect(body.bestAttempt.id).toBe("att2");
    expect(body.bestAttempt.passed).toBe(true);
  });

  it("uses default passingScore of 70 when content is null", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue({ ...mockLesson, content: null });
    mockPrisma.quizQuestion.findMany.mockResolvedValue([]);
    mockPrisma.quizAttempt.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest(), makeParams("c1", "m1", "l1"));
    const body = await res.json();
    expect(body.passingScore).toBe(70);
  });
});
