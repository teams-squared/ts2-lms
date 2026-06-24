import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AuditLogExplorer } from "@/components/admin/AuditLogExplorer";
import { AuditRetentionControl } from "@/components/admin/AuditRetentionControl";

export const metadata: Metadata = { title: "Audit Logs" };

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const session = await auth();
  // Admin-only — stricter than the /admin layout (which also lets course managers in).
  if (!session || session.user?.role !== "admin") {
    redirect("/admin");
  }

  const hold = await prisma.auditRetentionSettings.findUnique({
    where: { id: "singleton" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Audit logs</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Security audit trail for ISO 27001 evidence. Filter by date, action,
          or actor, then export a CSV plus its integrity manifest for the
          assessor. Re-hash the CSV (SHA-256) and match the manifest to prove it
          was not altered after export.
        </p>
      </div>

      <AuditRetentionControl
        initialPaused={hold?.prunePaused ?? false}
        initialReason={hold?.pauseReason ?? ""}
        updatedAt={hold?.updatedAt ? hold.updatedAt.toISOString() : null}
      />

      <AuditLogExplorer />
    </div>
  );
}
