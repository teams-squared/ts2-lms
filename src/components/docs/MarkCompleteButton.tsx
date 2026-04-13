"use client";

import { useState } from "react";
import type { DocProgress } from "@/lib/types";

interface MarkCompleteButtonProps {
  docKey: string;
  existingProgress: DocProgress | null;
}

export default function MarkCompleteButton({
  docKey,
  existingProgress,
}: MarkCompleteButtonProps) {
  const [completed, setCompleted] = useState(
    existingProgress?.completedAt !== null &&
      existingProgress?.completedAt !== undefined
  );
  const [completedAt, setCompletedAt] = useState(
    existingProgress?.completedAt ?? null
  );
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docKey,
          update: { completedAt: now },
        }),
      });
      setCompleted(true);
      setCompletedAt(now);
    } catch (err) {
      console.error("Failed to mark as complete:", err);
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 px-5 py-4 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-green-600 dark:text-green-400 text-lg">&#10003;</span>
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Completed
            </p>
            {completedAt && (
              <p className="text-xs text-green-600 dark:text-green-500">
                {new Date(completedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        onClick={handleComplete}
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-[#3a3a48] text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-400 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Mark as Complete &#10003;"}
      </button>
    </div>
  );
}
