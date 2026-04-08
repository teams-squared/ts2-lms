"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useMessage } from "@/hooks/useMessage";
import DeleteDocModal from "./DeleteDocModal";
import type { DocMeta, Category } from "@/lib/types";

interface Props {
  docs: DocMeta[];
  categories: Category[];
}

export default function DocTable({ docs, categories }: Props) {
  const router = useRouter();
  const { message, showMessage } = useMessage(4000);
  const [deleteTarget, setDeleteTarget] = useState<DocMeta | null>(null);
  // Map of "category/slug" → selected target category for the move dropdown
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [moving, setMoving] = useState<string | null>(null);

  // Leaf categories only (same logic as DocUploader)
  const leafCategories = categories.filter(
    (c) => !categories.some((other) => other.parentCategory === c.slug)
  );
  const categoryTitleMap = Object.fromEntries(categories.map((c) => [c.slug, c.title]));

  function getMoveTarget(doc: DocMeta) {
    return moveTargets[`${doc.category}/${doc.slug}`] ?? doc.category;
  }

  async function handleMove(doc: DocMeta) {
    const toCategory = getMoveTarget(doc);
    if (toCategory === doc.category) return;
    const key = `${doc.category}/${doc.slug}`;
    setMoving(key);
    try {
      const res = await fetch("/api/admin/docs/move", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCategory: doc.category,
          fromSlug: doc.slug,
          toCategory,
          toSlug: doc.slug,
        }),
      });
      if (res.ok) {
        showMessage("success", `Moved "${doc.title}" to ${categoryTitleMap[toCategory] ?? toCategory}`);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showMessage("error", data.error ?? "Move failed");
      }
    } catch {
      showMessage("error", "Network error — move failed");
    } finally {
      setMoving(null);
    }
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">All Documents</h2>
          {message && (
            <div
              className={`text-xs px-3 py-1 rounded-full ${
                message.type === "success"
                  ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-[#26262e]">
            <thead className="bg-gray-50 dark:bg-[#18181e]">
              <tr>
                {["Document", "Category", "Min Role", "Updated", "Move to", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider ${
                      i === 5 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#22222e]">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-600">
                    No documents found
                  </td>
                </tr>
              ) : (
                docs.map((doc) => {
                  const key = `${doc.category}/${doc.slug}`;
                  const isMoving = moving === key;
                  const moveTarget = getMoveTarget(doc);
                  const canMove = moveTarget !== doc.category;

                  return (
                    <tr key={key} className="hover:bg-gray-50/50 dark:hover:bg-[#1e1e28] transition-colors">
                      {/* Title */}
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/docs/${doc.category}/${doc.slug}`}
                          className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          {doc.title}
                        </Link>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400">
                        {categoryTitleMap[doc.category] ?? doc.category}
                      </td>

                      {/* Min role badge */}
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-[#1a0d2e] text-brand-700 dark:text-brand-300">
                          {doc.minRole}+
                        </span>
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-2.5 text-sm text-gray-400 dark:text-gray-600">
                        {doc.updatedAt}
                      </td>

                      {/* Move dropdown + button */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={moveTarget}
                            onChange={(e) =>
                              setMoveTargets((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="py-1 text-xs"
                            disabled={isMoving}
                          >
                            {leafCategories.map((c) => (
                              <option key={c.slug} value={c.slug}>
                                {c.title}
                              </option>
                            ))}
                          </Select>
                          <Button
                            variant="secondary"
                            className="py-1 text-xs"
                            disabled={!canMove || isMoving}
                            onClick={() => handleMove(doc)}
                          >
                            {isMoving ? "…" : "Move"}
                          </Button>
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="text-xs text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <DeleteDocModal
          doc={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
