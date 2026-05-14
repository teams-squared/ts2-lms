import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Capture send() invocations against a stubbed Resend instance.
const sendMock = vi.fn().mockResolvedValue({ id: "msg-1" });
vi.mock("resend", () => {
  class Resend {
    emails = { send: sendMock };
    constructor(_key?: string) {}
  }
  return { Resend };
});

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "Teams Squared LMS <lms-noreply@teamsquared.io>";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendManualOverdueReminderEmail", () => {
  it("no-ops when RESEND_API_KEY is unset (resend module instance is null)", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Course",
      lessonTitles: ["L1"],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no-ops when lessonTitles is empty", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Course",
      lessonTitles: [],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends with singular subject when exactly one overdue lesson", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Security Basics",
      lessonTitles: ["Password Hygiene"],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toBe(
      'Reminder: overdue lesson in "Security Basics"',
    );
    expect(payload.to).toBe("u@t.com");
    expect(payload.html).toContain("Password Hygiene");
  });

  it("sends with plural subject and lesson count when multiple overdue", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Security",
      lessonTitles: ["L1", "L2", "L3"],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
    });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toBe('Reminder: 3 overdue lessons in "Security"');
    expect(payload.html).toContain("<li");
  });

  it("escapes lesson title HTML to prevent template injection", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Course",
      lessonTitles: ["<script>alert(1)</script>"],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the manager note when provided", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Course",
      lessonTitles: ["L1"],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
      note: "<b>finish</b> now",
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain("&lt;b&gt;finish&lt;/b&gt; now");
    expect(html).toContain("blockquote");
  });

  it("omits the note blockquote when note is not provided", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Course",
      lessonTitles: ["L1"],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain("blockquote");
  });

  it("renders generic greeting when learnerName is null", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: null,
      courseTitle: "Course",
      lessonTitles: ["L1"],
      senderName: "Manager",
      courseUrl: "https://app/course/c1",
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain("Hi there,");
  });

  it("includes the course URL as the action button href", async () => {
    const { sendManualOverdueReminderEmail } = await import("@/lib/email");
    await sendManualOverdueReminderEmail({
      to: "u@t.com",
      learnerName: "Akil",
      courseTitle: "Course",
      lessonTitles: ["L1"],
      senderName: "Manager",
      courseUrl: "https://app.example.com/courses/abc",
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain('href="https://app.example.com/courses/abc"');
  });
});
