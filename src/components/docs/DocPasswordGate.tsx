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
        // Cookie is now set — re-run the server component to reveal content
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
        {/* Lock icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
            <LockIcon className="w-7 h-7 text-brand-500" />
          </div>
        </div>

        {/* Doc info */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
          <p className="text-sm text-gray-400 mt-3">
            This document is password protected. Enter the password to continue.
          </p>
        </div>

        {/* Password form */}
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
                ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                : ""
            }
          />

          {error && <p className="text-xs text-red-500 px-1">{error}</p>}

          <Button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 justify-center focus:ring-offset-1"
          >
            {loading ? "Verifying…" : "Unlock Document"}
          </Button>
        </form>
      </div>
    </div>
  );
}
