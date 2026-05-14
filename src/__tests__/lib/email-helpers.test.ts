import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Resend stub — must be declared before vi.mock so the factory can close over it.
// ---------------------------------------------------------------------------
const sendMock = vi.fn();
vi.mock("resend", () => {
  class Resend {
    emails = { send: sendMock };
    constructor(_key?: string) {}
  }
  return { Resend };
});

// ---------------------------------------------------------------------------
// Prisma stub — inline models needed by email.ts (inviteEmailTemplate,
// emailSignature).  Other models are irrelevant here so we stub minimally.
// ---------------------------------------------------------------------------
const mockFindUniqueInviteTemplate = vi.fn();
const mockFindUniqueEmailSignature = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inviteEmailTemplate: { findUnique: mockFindUniqueInviteTemplate },
    emailSignature: { findUnique: mockFindUniqueEmailSignature },
  },
}));

// ---------------------------------------------------------------------------
// Env snapshot
// ---------------------------------------------------------------------------
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // Default: API key set, reasonable FROM address.
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "Teams Squared LMS <lms-noreply@teamsquared.io>";
  // Default send resolves successfully (no error property).
  sendMock.mockResolvedValue({});
  // Default: no invite template row, no email signature row.
  mockFindUniqueInviteTemplate.mockResolvedValue(null);
  mockFindUniqueEmailSignature.mockResolvedValue(null);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ===========================================================================
// sendCourseCompletionEmail
// ===========================================================================
describe("sendCourseCompletionEmail", () => {
  it("no-ops when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendCourseCompletionEmail } = await import("@/lib/email");
    await sendCourseCompletionEmail(["mgr@co.com"], "Alice", "ISO 9001");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no-ops when to array is empty", async () => {
    const { sendCourseCompletionEmail } = await import("@/lib/email");
    await sendCourseCompletionEmail([], "Alice", "ISO 9001");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("happy path: sends once with correct subject and html content", async () => {
    const { sendCourseCompletionEmail } = await import("@/lib/email");
    await sendCourseCompletionEmail(
      ["mgr@co.com", "hr@co.com"],
      "Alice Smith",
      "Security Basics",
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toBe('Alice Smith completed "Security Basics"');
    expect(payload.to).toEqual(["mgr@co.com", "hr@co.com"]);
    expect(payload.html).toContain("Alice Smith");
    expect(payload.html).toContain("Security Basics");
  });

  it("applies escapeHtml to employeeName and courseTitle in the html body", async () => {
    const { sendCourseCompletionEmail } = await import("@/lib/email");
    await sendCourseCompletionEmail(
      ["mgr@co.com"],
      "<b>Alice</b>",
      "<script>xss()</script>",
    );
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain("<script>xss()</script>");
    expect(html).not.toContain("<b>Alice</b>");
    expect(html).toContain("&lt;b&gt;Alice&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;xss()&lt;/script&gt;");
  });
});

// ===========================================================================
// sendUserInviteEmail
// ===========================================================================
describe("sendUserInviteEmail", () => {
  it("no-ops and returns false when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendUserInviteEmail } = await import("@/lib/email");
    const result = await sendUserInviteEmail({
      to: "user@co.com",
      name: "Bob",
      inviterName: "Admin",
      assignedCourses: [],
    });
    expect(result).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no-ops and returns false when to is empty string", async () => {
    const { sendUserInviteEmail } = await import("@/lib/email");
    const result = await sendUserInviteEmail({
      to: "",
      name: "Bob",
      inviterName: "Admin",
      assignedCourses: [],
    });
    expect(result).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("uses DEFAULT_INVITE_BODY when template row is absent (findUnique returns null)", async () => {
    mockFindUniqueInviteTemplate.mockResolvedValue(null);
    const { sendUserInviteEmail, DEFAULT_INVITE_BODY } = await import(
      "@/lib/email"
    );
    await sendUserInviteEmail({
      to: "user@co.com",
      name: "Bob Jones",
      inviterName: "Carol Admin",
      assignedCourses: [],
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0];
    // Default subject
    expect(payload.subject).toBe("You've been added to Teams Squared LMS");
    // DEFAULT_INVITE_BODY contains {{inviterName}} — rendered to Carol Admin.
    expect(payload.html).toContain("Carol Admin");
  });

  it("uses persisted template subject and body when row is present", async () => {
    mockFindUniqueInviteTemplate.mockResolvedValue({
      id: "singleton",
      subject: "Custom: Welcome aboard!",
      bodyText:
        "Hey {{firstName}}, {{inviterName}} invited you. {{courses}}",
      ccEmails: [],
    });
    const { sendUserInviteEmail } = await import("@/lib/email");
    await sendUserInviteEmail({
      to: "user@co.com",
      name: "Dave",
      inviterName: "Eve",
      assignedCourses: ["Onboarding 101"],
    });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toBe("Custom: Welcome aboard!");
    expect(payload.html).toContain("Eve");
    // Courses block should appear since assignedCourses is non-empty.
    expect(payload.html).toContain("Onboarding 101");
  });

  it("displayName falls back to email local-part when name is null", async () => {
    const { sendUserInviteEmail } = await import("@/lib/email");
    await sendUserInviteEmail({
      to: "frank.miller@co.com",
      name: null,
      inviterName: "Grace",
      assignedCourses: [],
    });
    const html = sendMock.mock.calls[0][0].html as string;
    // Email local-part is "frank.miller"
    expect(html).toContain("frank.miller");
  });

  it("displayName falls back to email local-part when name is blank string", async () => {
    const { sendUserInviteEmail } = await import("@/lib/email");
    await sendUserInviteEmail({
      to: "frank.miller@co.com",
      name: "   ",
      inviterName: "Grace",
      assignedCourses: [],
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain("frank.miller");
  });

  it("returns true on successful send", async () => {
    const { sendUserInviteEmail } = await import("@/lib/email");
    const result = await sendUserInviteEmail({
      to: "user@co.com",
      name: "Bob",
      inviterName: "Admin",
      assignedCourses: ["Course A"],
    });
    expect(result).toBe(true);
  });

  it("retries once on 429 / rate_limit_exceeded then succeeds", async () => {
    // First call returns a rate-limit error; second call succeeds.
    sendMock
      .mockResolvedValueOnce({
        error: { statusCode: 429, name: "rate_limit_exceeded", message: "Too many requests" },
      })
      .mockResolvedValueOnce({});

    vi.useFakeTimers();
    const { sendUserInviteEmail } = await import("@/lib/email");

    const promise = sendUserInviteEmail({
      to: "user@co.com",
      name: "Bob",
      inviterName: "Admin",
      assignedCourses: [],
    });

    // Advance past the 1100 ms retry delay.
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("throws on non-rate-limit Resend error", async () => {
    sendMock.mockResolvedValueOnce({
      error: {
        statusCode: 500,
        name: "internal_server_error",
        message: "Server exploded",
      },
    });
    const { sendUserInviteEmail } = await import("@/lib/email");
    await expect(
      sendUserInviteEmail({
        to: "user@co.com",
        name: "Bob",
        inviterName: "Admin",
        assignedCourses: [],
      }),
    ).rejects.toThrow("[Resend] internal_server_error: Server exploded");
  });

  it("includes cc when template row has ccEmails", async () => {
    mockFindUniqueInviteTemplate.mockResolvedValue({
      id: "singleton",
      subject: "Welcome",
      bodyText: "",
      ccEmails: ["hr@co.com", "cto@co.com"],
    });
    const { sendUserInviteEmail } = await import("@/lib/email");
    await sendUserInviteEmail({
      to: "user@co.com",
      name: "Bob",
      inviterName: "Admin",
      assignedCourses: [],
    });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.cc).toEqual(["hr@co.com", "cto@co.com"]);
  });

  it("omits cc when template row has empty ccEmails", async () => {
    mockFindUniqueInviteTemplate.mockResolvedValue({
      id: "singleton",
      subject: "Welcome",
      bodyText: "",
      ccEmails: [],
    });
    const { sendUserInviteEmail } = await import("@/lib/email");
    await sendUserInviteEmail({
      to: "user@co.com",
      name: "Bob",
      inviterName: "Admin",
      assignedCourses: [],
    });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.cc).toBeUndefined();
  });
});

// ===========================================================================
// sendDeadlineReminderEmail
// ===========================================================================
describe("sendDeadlineReminderEmail", () => {
  const BASE_ARGS = {
    to: "learner@co.com",
    learnerName: "Hank",
    courseTitle: "Safety First",
    lessonTitle: "Fire Exits",
    lessonUrl: "https://app/lesson/l1",
    daysOffset: 1,
  };

  it("no-ops when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendDeadlineReminderEmail } = await import("@/lib/email");
    await sendDeadlineReminderEmail({ ...BASE_ARGS, kind: "due_soon_1" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("due_soon_1: subject contains 'due tomorrow', urgency color #f59e0b in html", async () => {
    const { sendDeadlineReminderEmail } = await import("@/lib/email");
    await sendDeadlineReminderEmail({ ...BASE_ARGS, kind: "due_soon_1" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const { subject, html } = sendMock.mock.calls[0][0];
    expect(subject).toContain("due tomorrow");
    expect(html).toContain("#f59e0b");
  });

  it("due_today: subject contains 'Due today', urgency color #ef4444 in html", async () => {
    const { sendDeadlineReminderEmail } = await import("@/lib/email");
    await sendDeadlineReminderEmail({ ...BASE_ARGS, kind: "due_today" });
    const { subject, html } = sendMock.mock.calls[0][0];
    expect(subject).toContain("Due today");
    expect(html).toContain("#ef4444");
  });

  it("overdue_1: subject starts with 'Overdue:', urgency color #dc2626 in html", async () => {
    const { sendDeadlineReminderEmail } = await import("@/lib/email");
    await sendDeadlineReminderEmail({ ...BASE_ARGS, kind: "overdue_1" });
    const { subject, html } = sendMock.mock.calls[0][0];
    expect(subject).toMatch(/^Overdue:/);
    expect(html).toContain("#dc2626");
  });

  it("escapeHtml applied to lessonTitle in html body", async () => {
    const { sendDeadlineReminderEmail } = await import("@/lib/email");
    await sendDeadlineReminderEmail({
      ...BASE_ARGS,
      lessonTitle: '<img src=x onerror="pwnd()">',
      kind: "due_soon_1",
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain('<img src=x onerror="pwnd()">');
    expect(html).toContain("&lt;img");
  });

  it("sends to correct recipient", async () => {
    const { sendDeadlineReminderEmail } = await import("@/lib/email");
    await sendDeadlineReminderEmail({ ...BASE_ARGS, kind: "due_today" });
    expect(sendMock.mock.calls[0][0].to).toBe("learner@co.com");
  });
});

// ===========================================================================
// sendIsoAcknowledgementEmail
// ===========================================================================
describe("sendIsoAcknowledgementEmail", () => {
  const ACK_DATE = new Date("2026-03-15T10:30:00Z");
  const BASE_ARGS = {
    to: ["iso@co.com", "qm@co.com"],
    cc: [] as string[],
    employeeName: "Irene Doe",
    employeeEmail: "irene@co.com",
    courseTitle: "Quality Management",
    documentTitle: "QMS Procedure",
    documentCode: "QMS-001",
    documentVersion: "2.1",
    acknowledgedAt: ACK_DATE,
    acknowledgedHash: "abc123def456",
  };

  it("no-ops when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail(BASE_ARGS);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no-ops when to array is empty (admin notifications disabled)", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail({ ...BASE_ARGS, to: [] });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("happy path: sends once, subject contains employee name, doc code, and version", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail(BASE_ARGS);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const { subject } = sendMock.mock.calls[0][0];
    expect(subject).toContain("Irene Doe");
    expect(subject).toContain("QMS-001");
    expect(subject).toContain("2.1");
  });

  it("includes cc when cc.length > 0", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail({
      ...BASE_ARGS,
      cc: ["irene@co.com"],
    });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.cc).toEqual(["irene@co.com"]);
  });

  it("omits cc property when cc is empty", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail({ ...BASE_ARGS, cc: [] });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.cc).toBeUndefined();
  });

  it("audit hash and ISO timestamp appear in html", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail(BASE_ARGS);
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain("abc123def456");
    expect(html).toContain("2026-03-15T10:30:00.000Z");
  });

  it("escapeHtml applied to employeeName, courseTitle, documentTitle", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail({
      ...BASE_ARGS,
      employeeName: "<b>Evil</b>",
      courseTitle: "<script>xss()</script>",
      documentTitle: '"Quoted & <Dangerous>"',
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).not.toContain("<script>xss()</script>");
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;Quoted &amp;");
  });

  it("renders employee name from employeeEmail when employeeName is null", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail({
      ...BASE_ARGS,
      employeeName: null,
    });
    const { subject, html } = sendMock.mock.calls[0][0];
    // subject uses email when name is null
    expect(subject).toContain("irene@co.com");
    // html should contain the email too
    expect(html).toContain("irene@co.com");
  });

  it("sends to all configured admin recipients", async () => {
    const { sendIsoAcknowledgementEmail } = await import("@/lib/email");
    await sendIsoAcknowledgementEmail(BASE_ARGS);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toEqual(["iso@co.com", "qm@co.com"]);
  });
});
