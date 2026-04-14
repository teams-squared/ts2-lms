import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const hasMicrosoftProvider = !!(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-[#1c1c24] rounded-2xl shadow-elevated border border-gray-100 dark:border-[#2e2e3a] overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600" />

          <div className="p-7">
            <div className="flex flex-col items-center mb-7">
              <Logo size={36} showText />
              <h1 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Sign in to access your learning platform
              </p>
            </div>

            <Suspense fallback={<div className="text-center text-sm text-gray-400 py-4">Loading...</div>}>
              <LoginForm hasMicrosoftProvider={hasMicrosoftProvider} isProduction={isProduction} />
            </Suspense>

            {!hasMicrosoftProvider && !isProduction && (
              <div className="mt-5 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 text-xs leading-relaxed">
                <strong className="font-semibold">Demo accounts</strong>
                <div className="mt-1.5 space-y-0.5 font-mono text-xs">
                  <div>admin@teamssquared.com / admin123</div>
                  <div>manager@teamssquared.com / manager123</div>
                  <div>employee@teamssquared.com / employee123</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
