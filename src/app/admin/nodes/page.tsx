import { getNodeTree } from "@/lib/courseNodes";
import { NodeManager } from "@/components/admin/NodeManager";

export const dynamic = "force-dynamic";

export default async function AdminNodesPage() {
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
