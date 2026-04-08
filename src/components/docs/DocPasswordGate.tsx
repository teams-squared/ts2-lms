"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon } from "@/components/icons";
import { PasswordInput, Button } from "@/components/ui";

interface DocPasswordGateProps {
  category: string;
  slug: string;
  title: string;
  description: string;
}

export default function DocPasswordGate({
  category,
  slug,
  title,
  description,
}: DocPasswordGateProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/docs/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, slug, password }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          res.status === 401
            ? "Incorrect password. Please try again."
            : (data.error as string) || "Something went wrong."
        );
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-[#1a0d2e] border border-brand-100 dark:border-brand-900/50 flex items-center justify-center shadow-sm">
            <LockIcon className="w-7 h-7 text-brand-500 dark:text-brand-400" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          )}
          <p className="text-sm text-gray-400 dark:text-gray-600 mt-3">
            This document is password protected. Enter the password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <PasswordInput
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Enter password"
            autoFocus
            className={
              error
                ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 focus:border-red-400 focus:ring-red-100"
                : ""
            }
          />

          {error && <p className="text-xs text-red-500 dark:text-red-400 px-1">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 justify-center"
          >
            {loading ? "Verifying…" : "Unlock Document"}
          </Button>
        </form>
      </div>
    </div>
  );
}
