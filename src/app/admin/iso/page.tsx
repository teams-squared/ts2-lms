import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { IsoAckLog } from "@/components/admin/IsoAckLog";

export const dynamic = "force-dynamic";

export default async function AdminIsoPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-1">
        ISO acknowledgement log
      </h2>
      <p className="text-sm text-foreground-muted mb-4">
        Every employee acknowledgement of an ISO policy-document lesson
        is recorded here with the document version, audit hash, and
        timestamp the employee attested to. Filter by date range and
        download a CSV to hand to your ISO auditor. Notification email
        dispatch is configured separately under{" "}
        <span className="font-medium">Emails → ISO Ack Email</span>.
      </p>
      <IsoAckLog />
    </div>
  );
}
