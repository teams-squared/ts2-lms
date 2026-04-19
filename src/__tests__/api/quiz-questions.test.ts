import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const { POST } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/questions/route"
);
const { DELETE, PATCH } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/quiz/questions/[questionId]/route"
);

const makeParams = (id: string, moduleId: string, lessonId: string) => ({
  params: Promise.resolve({ id, moduleId, lessonId }),
});

const makeDeleteParams = (
  id: string,
  moduleId: string,
  lessonId: string,
  questionId: string,
) => ({
  params: Promise.resolve({ id, moduleId, lessonId, questionId }),
});

const makeRequest = (body: unknown) =>
  new Request(
    "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

const mockLesson = {
  id: "l1",
  moduleId: "m1",
  content: null,
  module: { courseId: "c1" },
};

const validBody = {
  text: "What is 2+2?",
  options: [
    { text: "3", isCorrect: false },
    { text: "4", isCorrect: true },
  ],
};

const mockCreatedQuestion = {
  id: "q1",
  lessonId: "l1",
  text: "What is 2+2?",
  order: 1,
  options: [
    { id: "o1", text: "3", isCorrect: false, order: 1 },
    { id: "o2", text: "4", isCorrect: true, order: 2 },
  ],
};

describe("POST .../quiz/questions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for employees", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(makeRequest(validBody), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson does not exist", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when text is missing", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(
      makeRequest({ options: validBody.options }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when fewer than 2 options provided", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(
      makeRequest({ text: "Q?", options: [{ text: "Only one", isCorrect: true }] }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when more than 4 options provided", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(
      makeRequest({
        text: "Q?",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
          { text: "C", isCorrect: false },
          { text: "D", isCorrect: false },
          { text: "E", isCorrect: false },
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when no option is marked correct", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(
      makeRequest({
        text: "Q?",
        options: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: false },
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when more than one option is marked correct", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await POST(
      makeRequest({
        text: "Q?",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: true },
        ],
      }),
      makeParams("c1", "m1", "l1"),
    );
    expect(res.status).toBe(400);
  });

  it("creates question successfully for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.count.mockResolvedValue(0);
    mockPrisma.quizQuestion.create.mockResolvedValue(mockCreatedQuestion);

    const res = await POST(makeRequest(validBody), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("q1");
    expect(body.options).toHaveLength(2);
  });

  it("creates question successfully for course_manager", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "course_manager" }));
    mockPrisma.course.findUnique.mockResolvedValue({ createdById: "test-user-id" });
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.count.mockResolvedValue(2);
    mockPrisma.quizQuestion.create.mockResolvedValue({
      ...mockCreatedQuestion,
      order: 3,
    });

    const res = await POST(makeRequest(validBody), makeParams("c1", "m1", "l1"));
    expect(res.status).toBe(201);
    // Verify order was calculated correctly
    expect(mockPrisma.quizQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 3 }),
      }),
    );
  });
});

describe("DELETE .../quiz/questions/[questionId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for employees", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when question not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique.mockResolvedValue(null);
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when question belongs to a different lesson", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique.mockResolvedValue({
      id: "q1",
      lessonId: "other-lesson",
    });
    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(404);
  });

  it("deletes question successfully for admin", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique.mockResolvedValue({
      id: "q1",
      lessonId: "l1",
    });
    mockPrisma.quizQuestion.delete.mockResolvedValue({ id: "q1" });

    const req = new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(mockPrisma.quizQuestion.delete).toHaveBeenCalledWith({
      where: { id: "q1" },
    });
  });
});

describe("PATCH .../quiz/questions/[questionId]", () => {
  beforeEach(() => vi.clearAllMocks());

  const makePatchRequest = (body: unknown) =>
    new Request(
      "http://localhost/api/courses/c1/modules/m1/lessons/l1/quiz/questions/q1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

  const mockQuestionWithOptions = {
    id: "q1",
    lessonId: "l1",
    text: "What is 2+2?",
    order: 1,
    options: [
      { id: "o1", text: "3", isCorrect: false, order: 1 },
      { id: "o2", text: "4", isCorrect: true, order: 2 },
    ],
  };

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ text: "Updated?" }), makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for employees", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "employee" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    const res = await PATCH(makePatchRequest({ text: "Updated?" }), makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ text: "Updated?" }), makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when question not found", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ text: "Updated?" }), makeDeleteParams("c1", "m1", "l1", "q1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when options array has fewer than 2 items", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique.mockResolvedValue(mockQuestionWithOptions);
    const res = await PATCH(
      makePatchRequest({ options: [{ id: "o1", text: "Only one", isCorrect: true }] }),
      makeDeleteParams("c1", "m1", "l1", "q1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when options has no correct answer", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique.mockResolvedValue(mockQuestionWithOptions);
    const res = await PATCH(
      makePatchRequest({
        options: [
          { id: "o1", text: "A", isCorrect: false },
          { id: "o2", text: "B", isCorrect: false },
        ],
      }),
      makeDeleteParams("c1", "m1", "l1", "q1"),
    );
    expect(res.status).toBe(400);
  });

  it("updates question text only", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique
      .mockResolvedValueOnce(mockQuestionWithOptions)
      .mockResolvedValueOnce({ ...mockQuestionWithOptions, text: "What is 3+3?" });
    mockPrisma.quizQuestion.update.mockResolvedValue({});

    const res = await PATCH(
      makePatchRequest({ text: "What is 3+3?" }),
      makeDeleteParams("c1", "m1", "l1", "q1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.quizQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { text: "What is 3+3?" } }),
    );
  });

  it("updates options when provided", async () => {
    mockAuth.mockResolvedValue(mockSession({ role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(mockLesson);
    mockPrisma.quizQuestion.findUnique
      .mockResolvedValueOnce(mockQuestionWithOptions)
      .mockResolvedValueOnce(mockQuestionWithOptions);
    mockPrisma.quizOption.update.mockResolvedValue({});

    const res = await PATCH(
      makePatchRequest({
        options: [
          { id: "o1", text: "Updated A", isCorrect: true },
          { id: "o2", text: "Updated B", isCorrect: false },
        ],
      }),
      makeDeleteParams("c1", "m1", "l1", "q1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.quizOption.update).toHaveBeenCalledTimes(2);
  });
});
