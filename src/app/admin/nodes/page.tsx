import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getNodeTree } from "@/lib/courseNodes";
import { NodeManager } from "@/components/admin/NodeManager";

export const dynamic = "force-dynamic";

export default async function AdminNodesPage() {
  // Defence in depth: the /admin layout already gates admin/course_manager,
  // but explicit per-page gating means a future routing change (e.g.
  // moving this out from under that layout) doesn't silently expose the
  // node manager. Course managers can manage the node tree because
  // hierarchy is a curation concern, not a security boundary.
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "admin" && role !== "course_manager") {
    redirect("/admin");
  }

  const tree = await getNodeTree();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Course Nodes
          </h2>
          <p className="text-xs text-foreground-muted mt-0.5">
            Organize courses into a hierarchy for easier enrollment and browsing.
          </p>
        </div>
      </div>
      <NodeManager initialTree={tree} />
    </div>
  );
}
