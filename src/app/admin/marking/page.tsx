import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadMarkingQueue } from "@/lib/marking";
import { MarkingQueueTable } from "@/components/admin/MarkingQueueTable";

export const dynamic = "force-dynamic";

export default async function AdminMarkingPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "course_manager")
  ) {
    redirect("/");
  }

  const userId = session.user.id as string;
  const role = session.user.role;
  const queue = (await loadMarkingQueue(userId, role)) ?? [];

  if (queue.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-foreground mb-6">Marking</h1>
        <div className="rounded-lg border border-border bg-surface shadow-sm p-6 text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            No assessments awaiting marking.
          </p>
          <p className="text-xs text-foreground-muted">
            Submitted assessment attempts will appear here once students complete
            them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Marking</h1>
      <MarkingQueueTable queue={queue} />
    </div>
  );
}
