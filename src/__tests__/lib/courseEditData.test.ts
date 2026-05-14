import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "@/__tests__/mocks/prisma";

vi.mock("@/lib/prisma", () => ({ default: mockPrisma, prisma: mockPrisma }));

vi.mock("@/lib/courseAccess", () => ({
  canManageCourse: vi.fn(),
}));

import { loadCourseEditData } from "@/lib/courseEditData";
import { canManageCourse } from "@/lib/courseAccess";
const mockCanManage = vi.mocked(canManageCourse);

beforeEach(() => {
  vi.clearAllMocks();
});

function fakeCourse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "course-1",
    title: "Test",
    status: "PUBLISHED",
    nodeId: "node-1",
    modules: [
      {
        id: "mod-1",
        title: "M1",
        order: 0,
        lessons: [
          {
            id: "lesson-1",
            title: "Intro",
            type: "TEXT",
            content: "body",
            order: 0,
            deadlineDays: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("loadCourseEditData", () => {
  it("returns null when the course doesn't exist", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(null);

    const result = await loadCourseEditData("missing", "user-1", "admin");

    expect(result).toBeNull();
    expect(mockCanManage).not.toHaveBeenCalled();
  });

  it("returns null when the user lacks manage permission", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(fakeCourse());
    mockCanManage.mockResolvedValueOnce(false);

    const result = await loadCourseEditData("course-1", "user-1", "employee");

    expect(result).toBeNull();
    // Should NOT have fetched quiz questions when permission was denied.
    expect(mockPrisma.quizQuestion.findMany).not.toHaveBeenCalled();
  });

  it("returns shaped data for a permitted manager with no quiz lessons", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(fakeCourse());
    mockCanManage.mockResolvedValueOnce(true);

    const result = await loadCourseEditData("course-1", "user-1", "course_manager");

    expect(result).not.toBeNull();
    expect(result!.modules[0].lessons[0].type).toBe("text");
    expect(result!.quizDataByLessonId).toEqual({});
    // No quiz lessons → no follow-up query.
    expect(mockPrisma.quizQuestion.findMany).not.toHaveBeenCalled();
    expect(result!.status).toBe("published");
    expect(result!.nodeId).toBe("node-1");
  });

  it("loads quiz questions and applies default passingScore=70 when content is null", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(
      fakeCourse({
        modules: [
          {
            id: "mod-1",
            title: "M1",
            order: 0,
            lessons: [
              {
                id: "quiz-1",
                title: "Quiz",
                type: "QUIZ",
                content: null,
                order: 0,
                deadlineDays: null,
              },
            ],
          },
        ],
      }),
    );
    mockCanManage.mockResolvedValueOnce(true);
    mockPrisma.quizQuestion.findMany.mockResolvedValueOnce([
      {
        id: "q-1",
        lessonId: "quiz-1",
        text: "What is 2+2?",
        order: 0,
        options: [
          { id: "o-1", text: "3", isCorrect: false, order: 0 },
          { id: "o-2", text: "4", isCorrect: true, order: 1 },
        ],
      },
    ]);

    const result = await loadCourseEditData("course-1", "user-1", "admin");

    expect(result!.quizDataByLessonId["quiz-1"].passingScore).toBe(70);
    expect(result!.quizDataByLessonId["quiz-1"].questions).toHaveLength(1);
    expect(result!.quizDataByLessonId["quiz-1"].questions[0].options).toHaveLength(2);
  });

  it("respects custom passingScore from lesson content JSON", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(
      fakeCourse({
        modules: [
          {
            id: "mod-1",
            title: "M1",
            order: 0,
            lessons: [
              {
                id: "quiz-1",
                title: "Quiz",
                type: "QUIZ",
                content: JSON.stringify({ passingScore: 85 }),
                order: 0,
                deadlineDays: null,
              },
            ],
          },
        ],
      }),
    );
    mockCanManage.mockResolvedValueOnce(true);
    mockPrisma.quizQuestion.findMany.mockResolvedValueOnce([]);

    const result = await loadCourseEditData("course-1", "user-1", "admin");

    expect(result!.quizDataByLessonId["quiz-1"].passingScore).toBe(85);
  });

  it("falls back to default passingScore when content is malformed JSON", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(
      fakeCourse({
        modules: [
          {
            id: "mod-1",
            title: "M1",
            order: 0,
            lessons: [
              {
                id: "quiz-1",
                title: "Quiz",
                type: "QUIZ",
                content: "not-json{{",
                order: 0,
                deadlineDays: null,
              },
            ],
          },
        ],
      }),
    );
    mockCanManage.mockResolvedValueOnce(true);
    mockPrisma.quizQuestion.findMany.mockResolvedValueOnce([]);

    const result = await loadCourseEditData("course-1", "user-1", "admin");

    expect(result!.quizDataByLessonId["quiz-1"].passingScore).toBe(70);
  });

  it("ignores non-numeric passingScore in content JSON", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(
      fakeCourse({
        modules: [
          {
            id: "mod-1",
            title: "M1",
            order: 0,
            lessons: [
              {
                id: "quiz-1",
                title: "Quiz",
                type: "QUIZ",
                content: JSON.stringify({ passingScore: "abc" }),
                order: 0,
                deadlineDays: null,
              },
            ],
          },
        ],
      }),
    );
    mockCanManage.mockResolvedValueOnce(true);
    mockPrisma.quizQuestion.findMany.mockResolvedValueOnce([]);

    const result = await loadCourseEditData("course-1", "user-1", "admin");

    expect(result!.quizDataByLessonId["quiz-1"].passingScore).toBe(70);
  });

  it("scopes quiz-question fetch to only the quiz lesson IDs in the course", async () => {
    mockPrisma.course.findUnique.mockResolvedValueOnce(
      fakeCourse({
        modules: [
          {
            id: "mod-1",
            title: "M1",
            order: 0,
            lessons: [
              {
                id: "text-1",
                title: "Reading",
                type: "TEXT",
                content: null,
                order: 0,
                deadlineDays: null,
              },
              {
                id: "quiz-A",
                title: "Quiz A",
                type: "QUIZ",
                content: null,
                order: 1,
                deadlineDays: null,
              },
              {
                id: "quiz-B",
                title: "Quiz B",
                type: "QUIZ",
                content: null,
                order: 2,
                deadlineDays: null,
              },
            ],
          },
        ],
      }),
    );
    mockCanManage.mockResolvedValueOnce(true);
    mockPrisma.quizQuestion.findMany.mockResolvedValueOnce([]);

    await loadCourseEditData("course-1", "user-1", "admin");

    const args = mockPrisma.quizQuestion.findMany.mock.calls[0][0];
    expect(args.where.lessonId.in).toEqual(["quiz-A", "quiz-B"]);
  });
});
