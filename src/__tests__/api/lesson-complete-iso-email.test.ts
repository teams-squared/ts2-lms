import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "../mocks/prisma";
import { mockAuth, mockSession } from "../mocks/auth";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockSendIsoAck = vi.fn().mockResolvedValue(undefined);
const mockSendCourseCompletion = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendIsoAcknowledgementEmail: (...args: unknown[]) => mockSendIsoAck(...args),
  sendCourseCompletionEmail: (...args: unknown[]) =>
    mockSendCourseCompletion(...args),
}));

const { POST } = await import(
  "@/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route"
);

const makeReq = () =>
  new Request("http://localhost/api/courses/c1/modules/m1/lessons/l1/complete", {
    method: "POST",
  });
const makeParams = () => ({
  params: Promise.resolve({ id: "c1", moduleId: "m1", lessonId: "l1" }),
});

const policyDocLesson = {
  id: "l1",
  moduleId: "m1",
  type: "POLICY_DOC" as const,
  module: { courseId: "c1", course: { title: "Quality Management" } },
  policyDoc: {
    sourceVersion: "2.3.1",
    sourceETag: "etag-abc",
    renderedHTMLHash: "hash-deadbeef",
    documentTitle: "Quality Manual",
    documentCode: "QM-001",
  },
};

const baseEnrollment = {
  id: "e1",
  userId: "user-1",
  courseId: "c1",
  enrolledAt: new Date("2026-01-01"),
  completedAt: null,
};

describe("POST lesson-complete — ISO ack email hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(mockSession({ id: "user-1" }));
    mockPrisma.lesson.findUnique.mockResolvedValue(policyDocLesson);
    mockPrisma.enrollment.findUnique.mockResolvedValue(baseEnrollment);
    mockPrisma.lessonProgress.upsert.mockResolvedValue({
      id: "lp1",
      userId: "user-1",
      lessonId: "l1",
      startedAt: new Date(),
      completedAt: new Date(),
    });
    mockPrisma.module.findMany.mockResolvedValue([
      { lessons: [{ id: "l1" }, { id: "l2" }] },
    ]);
    mockPrisma.lessonProgress.count.mockResolvedValue(1);
  });

  it("does NOT send when settings row is absent (feature off)", async () => {
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(mockSendIsoAck).not.toHaveBeenCalled();
  });

  it("does NOT send when toEmails is empty", async () => {
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue({
      id: "singleton",
      toEmails: [],
      ccEmails: ["someone@t.com"],
    });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(mockSendIsoAck).not.toHaveBeenCalled();
  });

  it("sends with employee Cc'd when toEmails is configured", async () => {
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue({
      id: "singleton",
      toEmails: ["officer@t.com", "owner@t.com"],
      ccEmails: ["audit@t.com"],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      name: "Nadun",
      email: "nadun@t.com",
    });

    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(200);

    expect(mockSendIsoAck).toHaveBeenCalledTimes(1);
    const args = mockSendIsoAck.mock.calls[0][0];
    expect(args.to).toEqual(["officer@t.com", "owner@t.com"]);
    expect(args.cc).toContain("audit@t.com");
    expect(args.cc).toContain("nadun@t.com"); // employee receipt
    expect(args.employeeName).toBe("Nadun");
    expect(args.employeeEmail).toBe("nadun@t.com");
    expect(args.courseTitle).toBe("Quality Management");
    expect(args.documentTitle).toBe("Quality Manual");
    expect(args.documentCode).toBe("QM-001");
    expect(args.documentVersion).toBe("2.3.1");
    expect(args.acknowledgedHash).toBe("hash-deadbeef");
  });

  it("does NOT duplicate the employee into Cc if they're already in the To list", async () => {
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue({
      id: "singleton",
      toEmails: ["nadun@t.com", "officer@t.com"],
      ccEmails: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      name: "Nadun",
      email: "nadun@t.com",
    });

    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(mockSendIsoAck).toHaveBeenCalledTimes(1);
    const args = mockSendIsoAck.mock.calls[0][0];
    expect(args.cc).not.toContain("nadun@t.com");
  });

  it("does NOT send for non-POLICY_DOC lessons even when settings are configured", async () => {
    mockPrisma.lesson.findUnique.mockResolvedValue({
      id: "l1",
      moduleId: "m1",
      type: "TEXT",
      module: { courseId: "c1", course: { title: "Onboarding" } },
      policyDoc: null,
    });
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue({
      id: "singleton",
      toEmails: ["officer@t.com"],
      ccEmails: [],
    });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(200);
    expect(mockSendIsoAck).not.toHaveBeenCalled();
  });

  it("still returns 200 if the email send throws (fire-and-forget)", async () => {
    mockPrisma.isoNotificationSettings.findUnique.mockResolvedValue({
      id: "singleton",
      toEmails: ["officer@t.com"],
      ccEmails: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      name: "Nadun",
      email: "nadun@t.com",
    });
    mockSendIsoAck.mockRejectedValueOnce(new Error("resend down"));

    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(200);
  });
});
