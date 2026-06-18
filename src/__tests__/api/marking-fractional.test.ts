import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/roles", () => ({
  requireRole: vi.fn().mockResolvedValue({ session: {}, userId: "mgr-1", role: "admin" }),
}));
vi.mock("@/lib/courseAccess", () => ({ canManageCourse: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/posthog-server", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/enrollments", () => ({ maybeCompleteCourse: vi.fn() }));
vi.mock("@/lib/xp", () => ({ awardXp: vi.fn().mockResolvedValue({ newAchievements: [] }) }));
vi.mock("@/lib/assessment", () => ({ finalizeIfExpired: vi.fn() }));

const { PATCH } = await import("@/app/api/admin/marking/[submissionId]/route");

const submissionParams = { params: Promise.resolve({ submissionId: "s1" }) };

function patch(marks: { questionId: string; awardedMarks: number }[]) {
  const req = new Request("http://localhost/api/admin/marking/s1", {
    method: "PATCH",
    body: JSON.stringify({ marks, pass: false }),
  });
  return PATCH(req, submissionParams);
}

describe("PATCH marking — fractional (half) marks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue({
      id: "s1",
      userId: "stu-1",
      lessonId: "l1",
      variantId: "v1",
      status: "SUBMITTED",
      autoScore: 3,
      lesson: { id: "l1", module: { course: { id: "c1" } } },
    });
    mockPrisma.assessmentQuestion.findMany.mockResolvedValue([
      { id: "q1", questionType: "FREE_TEXT", maxMarks: 5 },
    ]);
    mockPrisma.assessmentAnswer.upsert.mockResolvedValue({});
    mockPrisma.assessmentSubmission.update.mockResolvedValue({});
  });

  it("accepts a half-mark (4.5/5) and adds it to autoScore", async () => {
    const res = await patch([{ questionId: "q1", awardedMarks: 4.5 }]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manualScore).toBe(4.5);
    expect(body.totalScore).toBe(7.5); // autoScore 3 + 4.5
  });

  it("rejects a non-half-step mark (4.3)", async () => {
    const res = await patch([{ questionId: "q1", awardedMarks: 4.3 }]);
    expect(res.status).toBe(400);
    expect(mockPrisma.assessmentSubmission.update).not.toHaveBeenCalled();
  });

  it("rejects a mark above maxMarks", async () => {
    const res = await patch([{ questionId: "q1", awardedMarks: 5.5 }]);
    expect(res.status).toBe(400);
  });
});
