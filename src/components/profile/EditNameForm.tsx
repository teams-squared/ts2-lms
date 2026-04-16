"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

interface EditNameFormProps {
  currentName: string | null;
}

export function EditNameForm({ currentName }: EditNameFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update");
        return;
      }
      setEditing(false);
      toast("Name updated");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Edit name
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-base sm:text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setName(currentName ?? "");
          setError(null);
        }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </form>
  );
}
