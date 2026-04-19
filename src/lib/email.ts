import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? "Teams Squared LMS <noreply@teamsquared.io>";

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

/**
 * Send an invitation email to a newly pre-created user.
 * No-ops gracefully if RESEND_API_KEY is not configured. Returns true if the
 * email was dispatched, false if it was skipped (no API key, no recipient).
 */
export async function sendUserInviteEmail({
  to,
  inviterName,
  assignedCourses,
}: {
  to: string;
  inviterName: string;
  assignedCourses: string[];
}): Promise<boolean> {
  if (!resend || !to) {
    if (!resend) {
      console.info("[email] Resend not configured — skipping invite email");
    }
    return false;
  }

  const subject = "You've been added to Teams Squared LMS";
  const loginUrl = `${APP_URL}/login`;

  const coursesBlock =
    assignedCourses.length > 0
      ? `
        <p style="color: #4a4a5a; font-size: 15px; line-height: 1.6; margin-top: 20px;">
          You've been pre-assigned the following course${assignedCourses.length === 1 ? "" : "s"}:
        </p>
        <ul style="color: #4a4a5a; font-size: 15px; line-height: 1.7; padding-left: 20px;">
          ${assignedCourses.map((t) => `<li><strong>${escapeHtml(t)}</strong></li>`).join("")}
        </ul>
      `
      : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Welcome to Teams Squared LMS</h2>
      <p style="color: #4a4a5a; font-size: 15px; line-height: 1.6;">
        <strong>${escapeHtml(inviterName)}</strong> has added you to the Teams Squared learning platform.
        Sign in with your Microsoft work account to get started.
      </p>
      ${coursesBlock}
      <p style="margin: 28px 0;">
        <a
          href="${loginUrl}"
          style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 15px;"
        >
          Sign in to Teams Squared
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5ea; margin: 24px 0;" />
      <p style="color: #8e8e93; font-size: 12px;">
        If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  await resend.emails.send({ from: FROM, to, subject, html });
  return true;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
