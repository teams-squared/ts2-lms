import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? "Teams Squared LMS <noreply@lms.teamsquared.io>";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://learn.teamsquared.io";

/**
 * Send a course completion notification email.
 * No-ops gracefully if RESEND_API_KEY is not configured.
 */
export async function sendCourseCompletionEmail(
  to: string[],
  employeeName: string,
  courseTitle: string,
) {
  if (!resend || to.length === 0) return;

  const subject = `${employeeName} completed "${courseTitle}"`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Course Completed</h2>
      <p style="color: #4a4a5a; font-size: 15px; line-height: 1.6;">
        <strong>${employeeName}</strong> has completed the course
        <strong>&ldquo;${courseTitle}&rdquo;</strong>.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 24px 0;" />
      <p style="color: #8e8e93; font-size: 12px;">
        You are receiving this because your email is subscribed to completion alerts for this course.
      </p>
    </div>
  `;

  await resend.emails.send({ from: FROM, to, subject, html });
}

/** Default invite-email body template. Used when the admin hasn't saved
 *  a custom one in the InviteEmailTemplate table. Plain text with
 *  {{placeholder}} markers; rendered into the system HTML wrapper. */
export const DEFAULT_INVITE_BODY = `Hi {{firstName}},

{{inviterName}} has added you to the Teams Squared learning platform. Sign in with your Microsoft work account to get started.

{{courses}}

If you weren't expecting this invitation, you can safely ignore this email.`;

/** Substitute {{placeholders}} in a template body. Unknown placeholders
 *  are left as-is so admins notice them while authoring. */
function renderInviteBody(
  template: string,
  values: {
    name: string;
    firstName: string;
    inviterName: string;
    assignedCourses: string[];
    joinLink: string;
  },
): string {
  const coursesBlock =
    values.assignedCourses.length > 0
      ? `You've been pre-assigned the following course${
          values.assignedCourses.length === 1 ? "" : "s"
        }:\n${values.assignedCourses.map((t) => `  • ${t}`).join("\n")}`
      : "";

  const map: Record<string, string> = {
    name: values.name,
    firstName: values.firstName,
    inviterName: values.inviterName,
    courses: coursesBlock,
    joinLink: values.joinLink,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : `{{${key}}}`,
  );
}

/** Render the rendered-text body into the standard branded HTML wrapper.
 *  Paragraphs are split on blank lines; bullets (lines beginning with
 *  whitespace + bullet glyph) become <li>. Keeps admins in control of
 *  the copy without exposing them to raw HTML. */
function wrapInviteHtml(renderedBody: string, joinLink: string): string {
  const paragraphs = renderedBody
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\n/).map((l) => l.trim());
      const isList = lines.every((l) => /^[•\-*]\s+/.test(l));
      if (isList) {
        return `<ul style="color: #4a4a5a; font-size: 15px; line-height: 1.7; padding-left: 20px; margin: 16px 0;">${lines
          .map((l) => `<li>${escapeHtml(l.replace(/^[•\-*]\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }
      // Mixed: header/intro line + bullets below.
      const firstNonBullet = lines.findIndex((l) => !/^[•\-*]\s+/.test(l));
      const bulletStart = lines.findIndex((l) => /^[•\-*]\s+/.test(l));
      if (firstNonBullet === 0 && bulletStart > 0) {
        const intro = lines.slice(0, bulletStart).join(" ");
        const items = lines.slice(bulletStart);
        return `
          <p style="color: #4a4a5a; font-size: 15px; line-height: 1.6; margin: 16px 0 8px;">${escapeHtml(intro)}</p>
          <ul style="color: #4a4a5a; font-size: 15px; line-height: 1.7; padding-left: 20px; margin: 0 0 16px;">${items
            .map((l) => `<li>${escapeHtml(l.replace(/^[•\-*]\s+/, ""))}</li>`)
            .join("")}</ul>
        `;
      }
      return `<p style="color: #4a4a5a; font-size: 15px; line-height: 1.6; margin: 16px 0;">${escapeHtml(
        block,
      ).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Welcome to Teams Squared LMS</h2>
      ${paragraphs}
      <p style="margin: 28px 0;">
        <a
          href="${joinLink}"
          style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 15px;"
        >
          Sign in to Teams Squared
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 24px 0;" />
      <p style="color: #8e8e93; font-size: 12px;">
        Sent automatically by Teams Squared LMS. Do not reply to this email.
      </p>
    </div>
  `;
}

/**
 * Send an invitation email to a newly pre-created user.
 *
 * Reads the admin-configured InviteEmailTemplate (subject, bodyText,
 * ccEmails). If the row is missing or `bodyText` is empty, falls back to
 * the built-in DEFAULT_INVITE_BODY so the feature remains functional out
 * of the box. Body supports {{name}} {{firstName}} {{inviterName}}
 * {{courses}} {{joinLink}} placeholders.
 *
 * No-ops gracefully if RESEND_API_KEY is not configured. Returns true if
 * the email was dispatched, false if it was skipped (no API key, no
 * recipient).
 */
export async function sendUserInviteEmail({
  to,
  name,
  inviterName,
  assignedCourses,
}: {
  to: string;
  /** Invited user's display name (or email local-part if missing). */
  name?: string | null;
  inviterName: string;
  assignedCourses: string[];
}): Promise<boolean> {
  if (!resend || !to) {
    if (!resend) {
      console.info("[email] Resend not configured — skipping invite email");
    }
    return false;
  }

  // Fetch template (best-effort — if the table doesn't exist yet, fall
  // back to defaults so we don't block invitations).
  let tpl: { subject: string; bodyText: string; ccEmails: string[] } | null =
    null;
  try {
    tpl = await prisma.inviteEmailTemplate.findUnique({
      where: { id: "singleton" },
    });
  } catch {
    /* table missing or DB hiccup — defaults will be used */
  }

  const subject =
    tpl?.subject?.trim() || "You've been added to Teams Squared LMS";
  const bodyTemplate = tpl?.bodyText?.trim() ? tpl.bodyText : DEFAULT_INVITE_BODY;
  const cc = tpl?.ccEmails?.length ? tpl.ccEmails : undefined;

  const displayName = name?.trim() || to.split("@")[0];
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const joinLink = `${APP_URL}/login`;

  const renderedBody = renderInviteBody(bodyTemplate, {
    name: displayName,
    firstName,
    inviterName,
    assignedCourses,
    joinLink,
  });

  const html = wrapInviteHtml(renderedBody, joinLink);

  await resend.emails.send({
    from: FROM,
    to,
    cc,
    subject,
    html,
  });
  return true;
}

/**
 * Send a deadline reminder email to a learner.
 * No-ops gracefully if RESEND_API_KEY is not configured.
 */
export async function sendDeadlineReminderEmail({
  to,
  learnerName,
  courseTitle,
  lessonTitle,
  kind,
  lessonUrl,
}: {
  to: string;
  learnerName: string | null;
  courseTitle: string;
  lessonTitle: string;
  kind: "due_soon_1" | "due_today" | "overdue_1";
  lessonUrl: string;
  daysOffset: number;
}): Promise<void> {
  if (!resend || !to) {
    if (!resend) {
      console.info("[email] Resend not configured — skipping deadline reminder");
    }
    return;
  }

  const greeting = learnerName ? `Hi ${escapeHtml(learnerName)},` : "Hi there,";
  const safeCourse = escapeHtml(courseTitle);
  const safeLesson = escapeHtml(lessonTitle);

  let subject: string;
  let headingText: string;
  let urgencyColor: string;
  let relativeText: string;

  if (kind === "due_soon_1") {
    subject = `Reminder: "${lessonTitle}" is due tomorrow`;
    headingText = "Lesson Due Tomorrow";
    urgencyColor = "#f59e0b";
    relativeText = "Due tomorrow";
  } else if (kind === "due_today") {
    subject = `Due today: "${lessonTitle}"`;
    headingText = "Lesson Due Today";
    urgencyColor = "#ef4444";
    relativeText = "Due today";
  } else {
    subject = `Overdue: "${lessonTitle}"`;
    headingText = "Lesson Overdue";
    urgencyColor = "#dc2626";
    relativeText = "Overdue";
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="color: ${urgencyColor}; margin-bottom: 16px;">${headingText}</h2>
      <p style="color: #4a4a5a; font-size: 15px; line-height: 1.6;">${greeting}</p>
      <p style="color: #4a4a5a; font-size: 15px; line-height: 1.6;">
        Your lesson <strong>&ldquo;${safeLesson}&rdquo;</strong> from the course
        <strong>&ldquo;${safeCourse}&rdquo;</strong> is
        <strong style="color: ${urgencyColor};">${relativeText.toLowerCase()}</strong>.
      </p>
      <p style="margin: 28px 0;">
        <a
          href="${lessonUrl}"
          style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 15px;"
        >
          Open Lesson
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 24px 0;" />
      <p style="color: #8e8e93; font-size: 12px;">
        You are receiving this because you are enrolled in a course with a deadline on Teams Squared LMS.
      </p>
    </div>
  `;

  await resend.emails.send({ from: FROM, to, subject, html });
}

/**
 * Send an ISO acknowledgement notification when an employee acknowledges a
 * POLICY_DOC lesson. Recipients are configured by admins under
 * /admin/settings → ISO notifications. Cc'd to the acknowledging employee
 * as their personal receipt.
 *
 * No-ops gracefully if RESEND_API_KEY is missing or `to` is empty (feature
 * is treated as disabled when no admin recipients are configured).
 */
export async function sendIsoAcknowledgementEmail({
  to,
  cc,
  employeeName,
  employeeEmail,
  courseTitle,
  documentTitle,
  documentCode,
  documentVersion,
  acknowledgedAt,
  acknowledgedHash,
}: {
  to: string[];
  cc: string[];
  employeeName: string | null;
  employeeEmail: string;
  courseTitle: string;
  documentTitle: string;
  documentCode: string | null;
  documentVersion: string;
  acknowledgedAt: Date;
  acknowledgedHash: string;
}): Promise<void> {
  if (!resend || to.length === 0) {
    if (!resend) {
      console.info("[email] Resend not configured — skipping ISO ack email");
    }
    return;
  }

  const safeEmployee = escapeHtml(employeeName ?? employeeEmail);
  const safeEmail = escapeHtml(employeeEmail);
  const safeCourse = escapeHtml(courseTitle);
  const safeDoc = escapeHtml(documentTitle);
  const safeCode = documentCode ? escapeHtml(documentCode) : null;
  const safeVersion = escapeHtml(documentVersion);
  const isoTime = acknowledgedAt.toISOString();
  const localTime = acknowledgedAt.toUTCString();
  const safeHash = escapeHtml(acknowledgedHash);

  const docLine = safeCode
    ? `${safeDoc} <span style="color: #8e8e93;">(${safeCode})</span> v${safeVersion}`
    : `${safeDoc} v${safeVersion}`;

  const subject = `ISO ack: ${employeeName ?? employeeEmail} — ${documentTitle}${documentCode ? ` (${documentCode})` : ""} v${documentVersion}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 0;">
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">ISO Document Acknowledgement</h2>
      <p style="color: #4a4a5a; font-size: 15px; line-height: 1.6;">
        <strong>${safeEmployee}</strong> has acknowledged reading the following ISO document.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <tbody>
          <tr><td style="padding: 8px 0; color: #8e8e93; width: 160px;">Employee</td><td style="padding: 8px 0; color: #1a1a2e;">${safeEmployee} &lt;${safeEmail}&gt;</td></tr>
          <tr><td style="padding: 8px 0; color: #8e8e93;">Course</td><td style="padding: 8px 0; color: #1a1a2e;">${safeCourse}</td></tr>
          <tr><td style="padding: 8px 0; color: #8e8e93;">Document</td><td style="padding: 8px 0; color: #1a1a2e;">${docLine}</td></tr>
          <tr><td style="padding: 8px 0; color: #8e8e93;">Acknowledged</td><td style="padding: 8px 0; color: #1a1a2e;">${escapeHtml(localTime)}<br/><span style="color: #8e8e93; font-size: 12px;">${escapeHtml(isoTime)}</span></td></tr>
          <tr><td style="padding: 8px 0; color: #8e8e93;">Audit hash</td><td style="padding: 8px 0; color: #1a1a2e; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all;">${safeHash}</td></tr>
        </tbody>
      </table>
      <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 24px 0;" />
      <p style="color: #8e8e93; font-size: 12px;">
        Automated audit notification from Teams Squared LMS. The audit hash above is the SHA-256 of the
        rendered document body the employee attested to reading and is recorded against their
        LessonProgress row for surveillance audits.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to,
    cc: cc.length > 0 ? cc : undefined,
    subject,
    html,
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
