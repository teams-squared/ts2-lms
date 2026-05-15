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
  // Password form is only shown when the server-side Credentials provider
  // is also registered (gated by ALLOW_PASSWORD_LOGIN). Production omits
  // the flag, so the form vanishes from the UI and the underlying
  // /api/auth/callback/credentials endpoint is not mounted either.
  const hasCredentialsProvider =
    process.env.ALLOW_PASSWORD_LOGIN === "true";

  return (
    <div className="bg-brand-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-hover to-primary" />

          <div className="p-6">
            <div className="mb-6 flex flex-col items-center">
              <Logo size={36} showText />
              <h1 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
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
                hasCredentialsProvider={hasCredentialsProvider}
              />
            </Suspense>

            {!hasMicrosoftProvider && hasCredentialsProvider && (
              <div className="mt-5 rounded-md border border-border bg-info-subtle p-4 text-xs leading-relaxed text-info">
                <strong className="font-semibold">Local dev sign-in</strong>
                <p className="mt-1">
                  No demo accounts are seeded by default. To bootstrap an
                  admin: insert a user row, then promote yourself via SQL —
                  see the file header comment in{" "}
                  <code className="font-mono">prisma/seed.ts</code>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
