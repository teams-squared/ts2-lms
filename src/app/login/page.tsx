import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const hasMicrosoftProvider = !!(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center bg-brand-gradient px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex flex-col items-center mb-8">
          <Logo size={48} />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to access documentation
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-gray-400">Loading...</div>}>
          <LoginForm hasMicrosoftProvider={hasMicrosoftProvider} />
        </Suspense>

        {!hasMicrosoftProvider && (
          <div className="mt-6 p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
            <strong>Demo accounts:</strong>
            <br />
            admin@teamssquared.com / admin123
            <br />
            manager@teamssquared.com / manager123
            <br />
            employee@teamssquared.com / employee123
          </div>
        )}
      </div>
    </div>
  );
}
