import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/attempt/route"
);

const makeParams = (id: string, moduleId: string, lessonId: string) => ({
  params: Promise.resolve({ id, moduleId, lessonId }),
});

const makeRequest = (body: unknown) =>
  new Request(
    "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/attempt",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

const mockLesson = {
  id: "l1",
  moduleId: "m1",
  content: JSON.stringify({ passingScore: 70 }),
  module: { courseId: "c1" },
};

const mockQuestions = [
  {
    id: "q1",
    lessonId: "l1",
    text: "What is 2+2?",
    order: 1,
    options: [
      { id: "o1", text: "3", isCorrect: false, order: 1 },
      { id: "o2", text: "4", isCorrect: true, order: 2 },
    ],
  },
  {
    id: "q2",
    lessonId: "l1",
    text: "What is 3+3?",
    order: 2,
    options: [
      { id: "o3", text: "5", isCorrect: false, order: 1 },
      { id: "o4", text: "6", isCorrect: true, order: 2 },
    ],
  },
];

const mockAttempt = {
  id: "att1",
  userId: "test-user-id",
  lessonId: "l1",
  score: 2,
  totalQuestions: 2,
  passed: true,
  createdAt: new Date(),
};

describe("POST .../lessons/[lessonId]/quiz/attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is enrolled (required for non-admin access)
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "test-user-id",
      courseId: "c1",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ answers: [] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not enrolled", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ answers: [] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ answers: [] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when answers array is missing", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(makeRequest({}), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answers array is empty", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(makeRequest({ answers: [] }), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no questions exist", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue([]);
    const res = await POST(
      makeRequest({ answers: [{ questionId: "q1", selectedOptionId: "o1" }] }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no questions/i);
  });

  it("returns 400 when a question is not answered", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    // Only answer q1, not q2
    const res = await POST(
      makeRequest({ answers: [{ questionId: "q1", selectedOptionId: "o2" }] }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when option does not belong to question", async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    // o3 belongs to q2, not q1
    const res = await POST(
      makeRequest({
        answers: [
          { questionId: "q1", selectedOptionId: "o3" }, // wrong option for q1
          { questionId: "q2", selectedOptionId: "o4" },
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("scores correctly and returns results for all correct answers", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "test-user-id" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.create.mockResolvedValue(mockAttempt);
    mockPrisma.quizAnswer.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.lessonProgress.upsert.mockResolvedValue({});

    const res = await POST(
      makeRequest({
        answers: [
          { questionId: "q1", selectedOptionId: "o2" }, // correct
          { questionId: "q2", selectedOptionId: "o4" }, // correct
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(2);
    expect(body.totalQuestions).toBe(2);
    expect(body.percentage).toBe(100);
    expect(body.passed).toBe(true);
    expect(body.passingScore).toBe(70);
    // Per-question reveal is intentionally omitted (anti-gaming).
    expect(body.answers).toBeUndefined();
  });

  it("scores correctly for all wrong answers and does not auto-complete", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "test-user-id" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.create.mockResolvedValue({
      ...mockAttempt,
      score: 0,
      passed: false,
    });
    mockPrisma.quizAnswer.createMany.mockResolvedValue({ count: 2 });

    const res = await POST(
      makeRequest({
        answers: [
          { questionId: "q1", selectedOptionId: "o1" }, // wrong
          { questionId: "q2", selectedOptionId: "o3" }, // wrong
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(0);
    expect(body.percentage).toBe(0);
    expect(body.passed).toBe(false);
    // auto-complete should NOT be called
    expect(mockPrisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it("auto-completes lesson when quiz is passed", async () => {
    mockAuth.mockResolvedValue(mockSession({ id: "test-user-id" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.create.mockResolvedValue(mockAttempt);
    mockPrisma.quizAnswer.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.lessonProgress.upsert.mockResolvedValue({});

    await POST(
      makeRequest({
        answers: [
          { questionId: "q1", selectedOptionId: "o2" },
          { questionId: "q2", selectedOptionId: "o4" },
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );

    expect(mockPrisma.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: "test-user-id", lessonId: "l1" } },
      }),
    );
  });

  it("does NOT leak per-question correct/incorrect breakdown in the response", async () => {
    // Anti-gaming: the server must only return the score summary so a
    // learner can't submit, inspect the network response to see which
    // answer was correct, then resubmit with full knowledge.
    mockAuth.mockResolvedValue(mockSession({ id: "test-user-id" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);
    mockPrisma.quizAttempt.create.mockResolvedValue({
      ...mockAttempt,
      score: 1,
      passed: true,
    });
    mockPrisma.quizAnswer.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.lessonProgress.upsert.mockResolvedValue({});

    const res = await POST(
      makeRequest({
        answers: [
          { questionId: "q1", selectedOptionId: "o2" }, // correct
          { questionId: "q2", selectedOptionId: "o3" }, // wrong
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );

    const body = await res.json();
    expect(body.score).toBe(1);
    expect(body.totalQuestions).toBe(2);
    expect(body.passed).toBe(false);
    // Per-question reveal must be absent
    expect(body.answers).toBeUndefined();
    // And no stray correctOptionId / correct flags anywhere on the body
    expect(JSON.stringify(body)).not.toContain("correctOptionId");
  });

  it("scores attempt but skips persistence when course is locked at completed", async () => {
    // Locked enrollments: learner can take the quiz for review but no
    // QuizAttempt / QuizAnswer / lessonProgress / XP rows are written.
    mockAuth.mockResolvedValue(mockSession({ id: "test-user-id", role: "employee" }));
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      id: "e1",
      userId: "test-user-id",
      courseId: "c1",
      completedAt: new Date("2026-02-01"),
    });
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findMany.mockResolvedValue(mockQuestions);

    const res = await POST(
      makeRequest({
        answers: [
          { questionId: "q1", selectedOptionId: "o2" }, // correct
          { questionId: "q2", selectedOptionId: "o4" }, // correct
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locked).toBe(true);
    expect(body.score).toBe(2);
    expect(body.totalQuestions).toBe(2);
    expect(body.percentage).toBe(100);
    expect(body.passed).toBe(true);
    expect(body.xpAwarded).toBe(0);
    expect(body.courseComplete).toBe(false);
    expect(body.courseStats).toBeNull();
    // The key invariant: zero writes
    expect(mockPrisma.quizAttempt.create).not.toHaveBeenCalled();
    expect(mockPrisma.quizAnswer.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.lessonProgress.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.enrollment.update).not.toHaveBeenCalled();
  });
});
