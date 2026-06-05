import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SectorManager } from "@/components/admin/SectorManager";

export const dynamic = "force-dynamic";

export default async function ClearanceSectorsPage() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    redirect("/admin");
  }

  const sectors = await prisma.sector.findMany({
    orderBy: { label: "asc" },
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground">
          Clearance sectors
        </h2>
        <p className="text-xs text-foreground-muted mt-1">
          Sectors are named compartments used to gate access to courses and
          internal documents by clearance tier. Assign sectors to resources and
          grant users the matching clearance to control who can see what.
        </p>
      </div>

      <SectorManager initialSectors={sectors} />
    </div>
  );
}
