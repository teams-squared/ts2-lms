import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IsoNotificationSettingsForm } from "@/components/admin/IsoNotificationSettingsForm";
import { InviteEmailTemplateForm } from "@/components/admin/InviteEmailTemplateForm";
import { DEFAULT_INVITE_BODY } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Consolidated email-management surface for admins. Holds two sections
 * today — the user-invite template (subject, body with {{placeholders}},
 * Cc list) and the ISO acknowledgement audit-trail recipients. Future
 * email types (deadline reminders, course completion alerts, etc.) can
 * slot in as additional sections without expanding the admin nav.
 */
export default async function AdminEmailsPage() {
  // Layout already gates admin/course_manager; this page is admin-only.
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/admin");
  }

  const [isoSettings, inviteTemplate] = await Promise.all([
    prisma.isoNotificationSettings.findUnique({ where: { id: "singleton" } }),
    prisma.inviteEmailTemplate.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <div className="space-y-12">
      {/* ── Invite email ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          User invite email
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Sent to every user invited from{" "}
          <span className="font-medium">/admin/users</span>. Customize the
          subject and body, and Cc additional addresses (e.g. HR or
          onboarding) on every invite. Leave the body blank to use the
          built-in default. Placeholders like{" "}
          <code className="rounded bg-surface-muted px-1">{"{{firstName}}"}</code>{" "}
          are substituted per recipient.
        </p>
        <InviteEmailTemplateForm
          initialSubject={
            inviteTemplate?.subject ?? "You've been added to Teams Squared LMS"
          }
          initialBodyText={inviteTemplate?.bodyText ?? ""}
          initialCc={inviteTemplate?.ccEmails ?? []}
          defaultBodyText={DEFAULT_INVITE_BODY}
          updatedAt={inviteTemplate?.updatedAt ?? null}
        />
      </section>

      <hr className="border-border" />

      {/* ── ISO acknowledgement notifications ─────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          ISO acknowledgement notifications
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          When an employee acknowledges an ISO policy-document lesson, send
          an audit email to the addresses below. The acknowledging employee
          is automatically Cc&apos;d as their personal receipt. Leave the To
          list empty to disable the feature — acknowledgements still record
          to the database either way.
        </p>
        <IsoNotificationSettingsForm
          initialTo={isoSettings?.toEmails ?? []}
          initialCc={isoSettings?.ccEmails ?? []}
          updatedAt={isoSettings?.updatedAt ?? null}
        />
      </section>
    </div>
  );
}
