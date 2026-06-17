import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/courseAccess", () => ({
  canManageCourse: vi.fn().mockResolvedValue(true),
}));

const { POST } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/assessment/variants/[variantId]/questions/route"
);

function call(body: unknown) {
  const req = new Request("http://localhost/api/.../questions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req, {
    params: Promise.resolve({ id: "c1", moduleId: "m1", lessonId: "l1", variantId: "v1" }),
  });
}

describe("POST assessment questions — MULTI_SELECT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(mockSession({ id: "admin-1", role: "admin" }));
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      type: "ASSESSMENT",
      module: { courseId: "c1" },
    });
    mockPrisma.assessmentVariant.findUnique.mockResolvedValue({ id: "v1", lessonId: "l1" });
    mockPrisma.assessmentQuestion.aggregate.mockResolvedValue({ _max: { order: 0 } });
    mockPrisma.assessmentQuestion.create.mockImplementation(
      ({ data }: { data: { questionType: string } }) =>
        Promise.resolve({ id: "q-new", questionType: data.questionType, options: [] }),
    );
  });

  it("creates a MULTI_SELECT question with several correct options", async () => {
    const res = await call({
      text: "Which of these are mammals?",
      questionType: "MULTI_SELECT",
      maxMarks: 2,
      options: [
        { text: "Bat", isCorrect: true },
        { text: "Elephant", isCorrect: true },
        { text: "Lizard", isCorrect: false },
        { text: "Piranha", isCorrect: false },
      ],
    });
    expect(res.status).toBe(201);
    expect(mockPrisma.assessmentQuestion.create).toHaveBeenCalled();
  });

  it("accepts a MULTI_SELECT with exactly one correct option", async () => {
    const res = await call({
      text: "Pick the mammal",
      questionType: "MULTI_SELECT",
      maxMarks: 1,
      options: [
        { text: "Bat", isCorrect: true },
        { text: "Lizard", isCorrect: false },
      ],
    });
    expect(res.status).toBe(201);
  });

  it("rejects a MULTI_SELECT with zero correct options", async () => {
    const res = await call({
      text: "Pick the mammals",
      questionType: "MULTI_SELECT",
      maxMarks: 1,
      options: [
        { text: "Lizard", isCorrect: false },
        { text: "Piranha", isCorrect: false },
      ],
    });
    expect(res.status).toBe(400);
    expect(mockPrisma.assessmentQuestion.create).not.toHaveBeenCalled();
  });

  it("still requires exactly one correct option for MULTIPLE_CHOICE", async () => {
    const res = await call({
      text: "Pick one",
      questionType: "MULTIPLE_CHOICE",
      maxMarks: 1,
      options: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: true },
      ],
    });
    expect(res.status).toBe(400);
  });
});
