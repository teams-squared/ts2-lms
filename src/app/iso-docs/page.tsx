import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * /iso-docs — flat reference library.
 *
 * Any logged-in user (employee / course manager / admin) sees the curated
 * list of policy/ISO docs admins have exposed via /admin/iso/library. This
 * is reference reading only; ack evidence still goes through the course
 * path (PolicyDocLesson + LessonProgress).
 */
export default async function IsoDocsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/iso-docs");
  }

  const entries = await prisma.isoLibraryEntry.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      policyDocLesson: {
        select: {
          documentTitle: true,
          documentCode: true,
          sourceVersion: true,
          approver: true,
          lastReviewedOn: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex items-start gap-3">
        <ShieldCheck className="mt-1 h-6 w-6 flex-shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">ISO Docs</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Reference library of policy and procedure documents. View-only —
            ISO acknowledgements still happen inside the relevant course.
          </p>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-foreground-muted" aria-hidden="true" />
          <p className="mt-3 text-sm text-foreground-muted">
            No ISO docs have been added to the library yet.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {entries.map(({ id, policyDocLesson: doc }) => (
            <li key={id}>
              <Link
                href={`/iso-docs/${id}`}
                className="flex flex-col gap-1 px-4 py-3.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="font-medium text-foreground">
                    {doc.documentTitle}
                  </span>
                  <span className="ml-2 text-xs text-foreground-muted">
                    {doc.documentCode && (
                      <>
                        <span className="font-mono">{doc.documentCode}</span>
                        {" · "}
                      </>
                    )}
                    v{doc.sourceVersion}
                    {doc.approver && (
                      <span className="hidden sm:inline">
                        {" · "}Approved by {doc.approver}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-xs text-primary sm:ml-4 sm:flex-shrink-0">
                  Open ↗
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
