"use client";

import { useState } from "react";

interface ChangePasswordFormProps {
  /** True for SSO-only users who have no local password */
  isSsoOnly: boolean;
}

export function ChangePasswordForm({ isSsoOnly }: ChangePasswordFormProps) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Failed to update password");
        return;
      }
      resetFields();
      setSuccess(true);
      setOpen(false);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (isSsoOnly) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Password change is not available for SSO accounts.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
          data-testid="change-password-trigger"
        >
          Change password
        </button>
        {success && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Password updated successfully.
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-3 space-y-3 max-w-xs"
      data-testid="change-password-form"
    >
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Current password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          data-testid="current-password-input"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          New password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          data-testid="new-password-input"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Confirm new password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          data-testid="confirm-password-input"
        />
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" data-testid="password-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5"
          data-testid="save-password-button"
        >
          {saving ? "Saving…" : "Save password"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetFields();
            setSuccess(false);
          }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
