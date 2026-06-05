import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadAuthorSectorOptions } from "@/lib/clearance";
import { InternalDocEditor } from "@/components/internal-docs/InternalDocEditor";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Author a new internal document. Open to any member who holds a clearance
 * (they can only require sectors/tiers within their own grants). Users with no
 * clearance have nothing to author and are sent back to the library.
 */
export default async function NewInternalDocPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const { sectors, minTierBySector } = await loadAuthorSectorOptions(session.user.id, role);

  if (sectors.length === 0) {
    redirect("/internal-docs");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <Link href="/internal-docs" className="text-sm text-primary hover:underline">
          ← Internal docs
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">New internal document</h1>
      </div>
      <InternalDocEditor sectors={sectors} minTierBySector={minTierBySector} />
    </div>
  );
}
