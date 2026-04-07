"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface TagFilterProps {
  tags: string[];
}

export default function TagFilter({ tags }: TagFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  if (tags.length === 0) return null;

  function handleTag(tag: string) {
    if (tag === activeTag) {
      router.push("/docs");
    } else {
      router.push(`/docs?tag=${encodeURIComponent(tag)}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {tags.map((tag) => {
        const isActive = tag === activeTag;
        return (
          <button
            key={tag}
            onClick={() => handleTag(tag)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? "bg-brand-100 text-brand-800 ring-1 ring-brand-400"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tag}
          </button>
        );
      })}
      {activeTag && (
        <button
          onClick={() => router.push("/docs")}
          className="px-3 py-1 rounded-full text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          Clear filter ×
        </button>
      )}
    </div>
  );
}
