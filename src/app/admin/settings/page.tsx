import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IsoNotificationSettingsForm } from "@/components/admin/IsoNotificationSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Layout already gates admin/course_manager; this page is admin-only.
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/admin");
  }

  const settings = await prisma.isoNotificationSettings.findUnique({
    where: { id: "singleton" },
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          ISO acknowledgement notifications
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          When an employee acknowledges an ISO policy-document lesson, send an
          audit email to the addresses below. The acknowledging employee is
          automatically Cc&apos;d as their personal receipt. Leave the To list
          empty to disable the feature — acknowledgements still record to the
          database either way.
        </p>
        <IsoNotificationSettingsForm
          initialTo={settings?.toEmails ?? []}
          initialCc={settings?.ccEmails ?? []}
          updatedAt={settings?.updatedAt ?? null}
        />
      </section>
    </div>
  );
}
