"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon } from "@/components/icons";
import { PasswordInput, Button } from "@/components/ui";

interface DocProtectionPanelProps {
  category: string;
  slug: string;
  passwordProtected: boolean;
}

type PanelView = "idle" | "add" | "change";

export default function DocProtectionPanel({
  category,
  slug,
  passwordProtected,
}: DocProtectionPanelProps) {
  const router = useRouter();
  const [view, setView] = useState<PanelView>("idle");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setPassword("");
    setConfirm("");
    setError(null);
    setSuccess(null);
    setView("idle");
  }

  async function submit(passwordToSet: string | null) {
    setError(null);
    setSuccess(null);

    if (passwordToSet !== null) {
      if (passwordToSet.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (passwordToSet !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/docs/protect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, slug, password: passwordToSet }),
      });

      if (res.ok) {
        const msg =
          passwordToSet === null
            ? "Password protection removed."
            : "Password protection updated.";
        setSuccess(msg);
        setPassword("");
        setConfirm("");
        setView("idle");
        setTimeout(() => {
          router.refresh();
          setSuccess(null);
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) || "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const showForm = view === "add" || view === "change";
  const inputErrorClass = error
    ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 focus:border-red-400 focus:ring-red-100"
    : "";

  return (
    <div className="mt-10 pt-6 border-t border-gray-100 dark:border-[#26262e]">
      <div className="flex items-center gap-2 mb-3">
        <LockIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-600" />
        <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest">
          Password Protection
        </h3>
      </div>

      {success && (
        <p className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 rounded-lg px-3 py-2 mb-3">
          {success}
        </p>
      )}

      {!passwordProtected && view === "idle" && (
        <div className="flex items-center justify-between bg-gray-50 dark:bg-[#1e1e28] rounded-xl px-4 py-3 border border-gray-100 dark:border-[#2e2e3a]">
          <p className="text-sm text-gray-500 dark:text-gray-400">This document is not password protected.</p>
          <button
            onClick={() => { setError(null); setView("add"); }}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors ml-4 flex-shrink-0"
          >
            Add protection
          </button>
        </div>
      )}

      {passwordProtected && view === "idle" && (
        <div className="flex items-center justify-between bg-brand-50 dark:bg-[#1a0d2e] border border-brand-100 dark:border-brand-900/50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <LockIcon className="w-4 h-4 text-brand-500 dark:text-brand-400 flex-shrink-0" />
            <p className="text-sm text-brand-700 dark:text-brand-300 font-medium">Password protected</p>
          </div>
          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            <button
              onClick={() => { setError(null); setView("change"); }}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Change
            </button>
            <button
              onClick={() => submit(null)}
              disabled={loading}
              className="text-xs font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors disabled:opacity-50"
            >
              {loading ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-gray-50 dark:bg-[#1e1e28] rounded-xl px-4 py-4 space-y-3 border border-gray-100 dark:border-[#2e2e3a]">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {view === "add"
              ? "Set a password for this document. Users with the correct role will need to enter it each browser session."
              : "Enter a new password to replace the existing one."}
          </p>

          <div className="space-y-2">
            <PasswordInput
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="New password (min. 8 characters)"
              autoFocus
              className={inputErrorClass}
            />
            <PasswordInput
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              placeholder="Confirm password"
              className={inputErrorClass}
            />
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={() => submit(password)}
              disabled={loading || !password || !confirm}
              className="text-xs px-4 py-2"
            >
              {loading ? "Saving…" : view === "add" ? "Set password" : "Update password"}
            </Button>
            <Button
              variant="secondary"
              onClick={reset}
              disabled={loading}
              className="text-xs px-4 py-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
