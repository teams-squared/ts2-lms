"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useMessage } from "@/hooks/useMessage";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
}

export default function DocUploader({ categories }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categories[0]?.slug ?? "");
  const [uploading, setUploading] = useState(false);
  const { message, showMessage } = useMessage(4000);

  // Only leaf categories (categories that can actually hold docs)
  const leafCategories = categories.filter(
    (c) => !categories.some((other) => other.parentCategory === c.slug)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !category) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);

      const res = await fetch("/api/admin/docs", { method: "POST", body: fd });
      if (res.ok) {
        showMessage("success", `Uploaded ${file.name}`);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showMessage("error", data.error ?? "Upload failed");
      }
    } catch {
      showMessage("error", "Network error — upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload Document</h2>
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

      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card p-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          {/* File picker */}
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              .mdx file
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".mdx"
              required
              className="block w-full text-sm text-gray-700 dark:text-gray-300
                file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                file:text-xs file:font-medium
                file:bg-brand-50 file:text-brand-700
                dark:file:bg-[#1a0d2e] dark:file:text-brand-400
                hover:file:bg-brand-100 dark:hover:file:bg-[#220f3e]
                cursor-pointer"
            />
          </div>

          {/* Category picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Category
            </label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="py-1.5"
            >
              {leafCategories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" disabled={uploading} className="py-1.5">
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </form>

        <p className="mt-2 text-xs text-gray-400 dark:text-gray-600">
          File must be a valid <code className="font-mono">.mdx</code> file with{" "}
          <code className="font-mono">title</code> and{" "}
          <code className="font-mono">description</code> in its frontmatter.
          The filename (without extension) becomes the document slug.
        </p>
      </div>
    </div>
  );
}
