import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginForm from "@/components/auth/LoginForm";

/**
 * Login — the one place the brand gradient is used intentionally per
 * design-system §8. The hairline gradient accent at the card top echoes it.
 */
export default function LoginPage() {
  const hasMicrosoftProvider = !!(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="bg-brand-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-hover to-primary" />

          <div className="p-7">
            <div className="mb-7 flex flex-col items-center">
              <Logo size={36} showText />
              <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-foreground-muted">
                Sign in to access your learning platform
              </p>
            </div>

            <Suspense
              fallback={
                <div className="py-4 text-center text-sm text-foreground-subtle">
                  Loading…
                </div>
              }
            >
              <LoginForm
                hasMicrosoftProvider={hasMicrosoftProvider}
                isProduction={isProduction}
              />
            </Suspense>

            {!hasMicrosoftProvider && !isProduction && (
              <div className="mt-5 rounded-md border border-info/20 bg-info/10 p-3.5 text-xs leading-relaxed text-info">
                <strong className="font-semibold">Demo accounts</strong>
                <div className="mt-1.5 space-y-0.5 font-mono">
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
