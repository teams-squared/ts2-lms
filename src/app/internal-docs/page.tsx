import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, FolderLock, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterAccessibleDocIds, hasAnyClearance } from "@/lib/clearance";
import { prismaLessonTypeToApp, type Role } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Internal documentation library. Every entry is gated by clearance — the list
 * shows only docs the viewer is cleared for (admins see all). A doc with no
 * requirement is unreachable by design (emptyDefault = false), so the library
 * is invisible to anyone without a matching clearance (e.g. contractors).
 */
export default async function InternalDocsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role as Role;

  // Authoritative gate (live): only internal members reach the library at all.
  // Contractors / clearance-less users get a 404 — not even an empty shell.
  const isInternal = role === "admin" || (await hasAnyClearance(userId));
  if (!isInternal) notFound();

  const docs = await prisma.internalDoc.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      clearanceRequirements: { select: { sectorId: true, tier: true } },
    },
  });

  const accessible = await filterAccessibleDocIds(
    userId,
    role,
    docs.map((d) => ({ id: d.id, reqs: d.clearanceRequirements })),
    false,
  );
  const visible = docs.filter((d) => accessible.has(d.id));

  // "New document" is available to any internal member (same condition as
  // the route gate above).
  const canAuthor = isInternal;

  // Group by category; uncategorised last.
  const groups = new Map<string, typeof visible>();
  for (const d of visible) {
    const key = d.category?.trim() || "Uncategorised";
    const bucket = groups.get(key) ?? [];
    bucket.push(d);
    groups.set(key, bucket);
  }
  const sections = Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === "Uncategorised") return 1;
    if (b === "Uncategorised") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
            <FolderLock className="h-4 w-4" aria-hidden="true" />
            Internal
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Internal documentation</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
            Reference documentation for Teams Squared members. Access is gated by your
            clearance — you only see documents in sectors and tiers you are cleared for.
          </p>
        </div>
        {canAuthor && (
          <Link
            href="/internal-docs/new"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New document
          </Link>
        )}
      </header>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center text-sm text-foreground-muted">
          No documents you&apos;re cleared to see yet.
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map(([category, items]) => (
            <section key={category}>
              <div className="mb-3 flex items-baseline gap-3 border-b border-border pb-2">
                <h2 className="text-base font-semibold text-foreground">{category}</h2>
                <span className="text-xs text-foreground-subtle">
                  {items.length} doc{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/internal-docs/${doc.id}`}
                      className="flex h-full items-start gap-3 rounded-lg border border-border bg-surface p-4 hover-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{doc.title}</span>
                        <span className="mt-0.5 block text-xs capitalize text-foreground-muted">
                          {prismaLessonTypeToApp(doc.type)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
