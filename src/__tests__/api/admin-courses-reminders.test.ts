import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockCanManageCourse = vi.fn();
vi.mock("@/lib/courseAccess", () => ({
  canManageCourse: (...args: unknown[]) => mockCanManageCourse(...args),
}));

const mockSendManualOverdueReminderEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendManualOverdueReminderEmail: (...args: unknown[]) =>
    mockSendManualOverdueReminderEmail(...args),
}));

const { POST } = await import(
  "@/app/api/admin/courses/[id]/reminders/route"
);

const NOW = new Date("2026-05-14T00:00:00Z");

function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function makeReq(body: unknown) {
  return new Request("http://localhost/api/admin/courses/c1/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const makeParams = (id = "c1") => Promise.resolve({ id });

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(NOW);
  mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
});

describe("POST /api/admin/courses/[id]/reminders", () => {
  it("returns 403 when caller fails requireRole", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await POST(makeReq({ userId: "u1" }), { params: makeParams() });
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith("course_manager");
  });

  it("returns 403 when caller cannot manage the course", async () => {
    mockRequireRole.mockResolvedValue({
      userId: "caller",
      role: "course_manager",
    });
    mockCanManageCourse.mockResolvedValue(false);
    const res = await POST(makeReq({ userId: "u1" }), { params: makeParams() });
    expect(res.status).toBe(403);
    expect(mockCanManageCourse).toHaveBeenCalledWith(
      "caller",
      "course_manager",
      "c1",
    );
  });

  it("returns 400 when userId missing from body", async () => {
    mockRequireRole.mockResolvedValue({ userId: "caller", role: "admin" });
    mockCanManageCourse.mockResolvedValue(true);
    const res = await POST(makeReq({}), { params: makeParams() });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/userId/);
  });

  it("returns 400 when note exceeds 500 chars", async () => {
    mockRequireRole.mockResolvedValue({ userId: "caller", role: "admin" });
    mockCanManageCourse.mockResolvedValue(true);
    const res = await POST(
      makeReq({ userId: "u1", note: "x".repeat(501) }),
      { params: makeParams() },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/500/);
  });

  it("returns 400 on invalid JSON body", async () => {
    mockRequireRole.mockResolvedValue({ userId: "caller", role: "admin" });
    mockCanManageCourse.mockResolvedValue(true);
    const req = new Request("http://localhost/api/admin/courses/c1/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req, { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("returns 404 when enrollment does not exist", async () => {
    mockRequireRole.mockResolvedValue({ userId: "caller", role: "admin" });
    mockCanManageCourse.mockResolvedValue(true);
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ userId: "u1" }), { params: makeParams() });
    expect(res.status).toBe(404);
  });

  it("returns 400 when student already completed the course", async () => {
    mockRequireRole.mockResolvedValue({ userId: "caller", role: "admin" });
    mockCanManageCourse.mockResolvedValue(true);
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      enrolledAt: daysAgo(5),
      completedAt: daysAgo(1),
      user: { id: "u1", name: "Akil", email: "a@t.com" },
      course: { id: "c1", title: "Course", modules: [] },
    });
    const res = await POST(makeReq({ userId: "u1" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("returns 400 when no lessons are overdue", async () => {
    mockRequireRole.mockResolvedValue({ userId: "caller", role: "admin" });
    mockCanManageCourse.mockResolvedValue(true);
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      enrolledAt: daysAgo(1),
      completedAt: null,
      user: { id: "u1", name: "Akil", email: "a@t.com" },
      course: {
        id: "c1",
        title: "Course",
        modules: [
          {
            lessons: [
              { id: "L1", title: "Future", deadlineDays: 30 },
              { id: "L2", title: "No deadline", deadlineDays: null },
            ],
          },
        ],
      },
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);

    const res = await POST(makeReq({ userId: "u1" }), { params: makeParams() });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/overdue/i);
    expect(mockSendManualOverdueReminderEmail).not.toHaveBeenCalled();
  });

  it("sends email + writes ManualReminderLog rows for each overdue lesson", async () => {
    mockRequireRole.mockResolvedValue({
      userId: "caller",
      role: "course_manager",
    });
    mockCanManageCourse.mockResolvedValue(true);
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      enrolledAt: daysAgo(10),
      completedAt: null,
      user: { id: "u1", name: "Akil", email: "akil@t.com" },
      course: {
        id: "c1",
        title: "Security Basics",
        modules: [
          {
            lessons: [
              { id: "L1", title: "Late 1", deadlineDays: 1 },
              { id: "L2", title: "Late 2", deadlineDays: 1 },
              { id: "L3", title: "Future", deadlineDays: 100 },
              { id: "L4", title: "Late but done", deadlineDays: 1 },
            ],
          },
        ],
      },
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([
      { lessonId: "L4" },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      name: "Manager Bob",
      email: "bob@t.com",
    });

    const res = await POST(
      makeReq({ userId: "u1", note: "please finish" }),
      { params: makeParams() },
    );
    expect(res.status).toBe(200);

    expect(mockSendManualOverdueReminderEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendManualOverdueReminderEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe("akil@t.com");
    expect(emailArgs.courseTitle).toBe("Security Basics");
    expect(emailArgs.lessonTitles).toEqual(["Late 1", "Late 2"]);
    expect(emailArgs.senderName).toBe("Manager Bob");
    expect(emailArgs.note).toBe("please finish");

    expect(mockPrisma.manualReminderLog.createMany).toHaveBeenCalledTimes(1);
    const createArgs = mockPrisma.manualReminderLog.createMany.mock.calls[0][0];
    expect(createArgs.data).toEqual([
      { userId: "u1", lessonId: "L1", sentById: "caller" },
      { userId: "u1", lessonId: "L2", sentById: "caller" },
    ]);

    const body = await res.json();
    expect(body.lessonCount).toBe(2);
    expect(body.sentTo).toBe("akil@t.com");
  });

  it("strips empty/whitespace-only note before sending", async () => {
    mockRequireRole.mockResolvedValue({ userId: "caller", role: "admin" });
    mockCanManageCourse.mockResolvedValue(true);
    mockPrisma.enrollment.findUnique.mockResolvedValue({
      enrolledAt: daysAgo(10),
      completedAt: null,
      user: { id: "u1", name: "Akil", email: "akil@t.com" },
      course: {
        id: "c1",
        title: "Course",
        modules: [
          { lessons: [{ id: "L1", title: "Late", deadlineDays: 1 }] },
        ],
      },
    });
    mockPrisma.lessonProgress.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({
      name: "Admin",
      email: "admin@t.com",
    });

    await POST(makeReq({ userId: "u1", note: "   " }), {
      params: makeParams(),
    });

    const emailArgs = mockSendManualOverdueReminderEmail.mock.calls[0][0];
    expect(emailArgs.note).toBeUndefined();
  });
});
