"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon } from "@/components/icons";

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

    // Client-side validation for set/change
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
        // Re-run the server component so passwordProtected prop reflects new state
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

  return (
    <div className="mt-10 pt-6 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <LockIcon className="w-3.5 h-3.5 text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Password Protection
        </h3>
      </div>

      {success && (
        <p className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
          {success}
        </p>
      )}

      {!passwordProtected && view === "idle" && (
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-500">This document is not password protected.</p>
          <button
            onClick={() => { setError(null); setView("add"); }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors ml-4 flex-shrink-0"
          >
            Add protection
          </button>
        </div>
      )}

      {passwordProtected && view === "idle" && (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <LockIcon className="w-4 h-4 text-brand-500 flex-shrink-0" />
            <p className="text-sm text-brand-700 font-medium">Password protected</p>
          </div>
          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            <button
              onClick={() => { setError(null); setView("change"); }}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              Change
            </button>
            <button
              onClick={() => submit(null)}
              disabled={loading}
              className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-gray-50 rounded-lg px-4 py-4 space-y-3">
          <p className="text-xs text-gray-500">
            {view === "add"
              ? "Set a password for this document. Users with the correct role will need to enter it each browser session."
              : "Enter a new password to replace the existing one."}
          </p>

          <div className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="New password (min. 8 characters)"
              autoFocus
              className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors ${
                error
                  ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  : "border-gray-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              }`}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              placeholder="Confirm password"
              className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors ${
                error
                  ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  : "border-gray-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              }`}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => submit(password)}
              disabled={loading || !password || !confirm}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Saving…"
                : view === "add"
                ? "Set password"
                : "Update password"}
            </button>
            <button
              onClick={reset}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
