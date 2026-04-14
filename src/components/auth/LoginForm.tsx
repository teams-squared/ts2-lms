"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";

export default function LoginForm({
  hasMicrosoftProvider,
  isProduction,
}: {
  hasMicrosoftProvider: boolean;
  isProduction: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <div className="space-y-5">
      {/* Microsoft sign-in */}
      {hasMicrosoftProvider && (
        <>
          <button
            onClick={() => signIn("microsoft-entra-id", { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors text-sm shadow-sm"
          >
            <svg className="w-4.5 h-4.5 flex-shrink-0" viewBox="0 0 23 23" fill="none">
              <path d="M0 0h11v11H0z" fill="#f25022" />
              <path d="M12 0h11v11H12z" fill="#7fba00" />
              <path d="M0 12h11v11H0z" fill="#00a4ef" />
              <path d="M12 12h11v11H12z" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </button>

          {!isProduction && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-[#2e2e3a]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white dark:bg-[#1c1c24] text-gray-400">
                  or sign in with email
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Credentials form — dev only */}
      {!isProduction && (
        <form onSubmit={handleCredentialLogin} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              placeholder="you@teamssquared.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? <span className="inline-flex items-center gap-2"><Spinner size="sm" className="border-white border-t-transparent" /> Signing in…</span> : "Sign In"}
          </button>
        </form>
      )}
    </div>
  );
}
