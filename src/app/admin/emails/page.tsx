import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IsoNotificationSettingsForm } from "@/components/admin/IsoNotificationSettingsForm";
import { InviteEmailTemplateForm } from "@/components/admin/InviteEmailTemplateForm";
import { EmailSignatureForm } from "@/components/admin/EmailSignatureForm";
import { EmailsTabs, EmailsTabPanel } from "@/components/admin/EmailsTabs";
import { IsoAckLog } from "@/components/admin/IsoAckLog";
import { DEFAULT_INVITE_BODY, DEFAULT_SIGNATURE_DISCLAIMER } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Consolidated email-management surface for admins. Sub-tabbed by
 * category (Invite | Signature | ISO acks) so admins don't have to
 * scroll past unrelated forms to reach the one they want. Future
 * email types (deadline reminders, course completion alerts) slot in
 * as additional sub-tabs without expanding the top admin nav.
 */
export default async function AdminEmailsPage() {
  // Layout already gates admin/course_manager; this page is admin-only.
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/admin");
  }

  const [isoSettings, inviteTemplate, signature] = await Promise.all([
    prisma.isoNotificationSettings.findUnique({ where: { id: "singleton" } }),
    prisma.inviteEmailTemplate.findUnique({ where: { id: "singleton" } }),
    prisma.emailSignature.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <div>
      <EmailsTabs />

      <EmailsTabPanel tab="invite">
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
      </EmailsTabPanel>

      <EmailsTabPanel tab="signature">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Email signature
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Appended to the bottom of outbound LMS emails. Leave any field
          blank to omit that row. The signature currently applies to the
          user-invite email; future LMS email types will inherit it
          automatically.
        </p>
        <EmailSignatureForm
          enabled={signature?.enabled ?? true}
          signOff={signature?.signOff ?? "Best regards,"}
          name={signature?.name ?? ""}
          title={signature?.title ?? ""}
          email={signature?.email ?? ""}
          phone={signature?.phone ?? ""}
          websiteUrl={signature?.websiteUrl ?? ""}
          websiteLabel={signature?.websiteLabel ?? ""}
          addressLine={signature?.addressLine ?? ""}
          logoUrl={signature?.logoUrl ?? ""}
          disclaimer={signature?.disclaimer ?? ""}
          defaultDisclaimer={DEFAULT_SIGNATURE_DISCLAIMER}
          updatedAt={signature?.updatedAt ?? null}
        />
      </EmailsTabPanel>

      <EmailsTabPanel tab="iso-ack">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          ISO acknowledgement notifications
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          When enabled and an employee acknowledges an ISO policy-document
          lesson, an audit email is sent to the addresses below. The
          acknowledging employee is automatically Cc&apos;d as their personal
          receipt. The audit record itself is always written to the database
          regardless of this toggle — see the ISO ack log tab to view or
          export acknowledgements for auditors.
        </p>
        <IsoNotificationSettingsForm
          initialEnabled={isoSettings?.enabled ?? false}
          initialTo={isoSettings?.toEmails ?? []}
          initialCc={isoSettings?.ccEmails ?? []}
          updatedAt={isoSettings?.updatedAt ?? null}
        />
      </EmailsTabPanel>

      <EmailsTabPanel tab="iso-log">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          ISO acknowledgement log
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Every employee acknowledgement of an ISO policy-document lesson
          is recorded here with the document version, audit hash, and
          timestamp the employee attested to. Filter by date range and
          download a CSV to hand to your ISO auditor.
        </p>
        <IsoAckLog />
      </EmailsTabPanel>
    </div>
  );
}
