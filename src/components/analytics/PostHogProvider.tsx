"use client";

import dynamic from "next/dynamic";

const key =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_POSTHOG_KEY : undefined;

/**
 * Lazy-loaded PostHog wrapper. When no NEXT_PUBLIC_POSTHOG_KEY is set, the
 * posthog-js bundle is never loaded — saving ~100 KB on initial page weight.
 * When a key is present, the inner provider is imported on the client only.
 */
const LazyPostHogProvider = dynamic(
  () =>
    import("./PostHogProviderInner").then((m) => ({ default: m.PostHogProviderInner })),
  { ssr: false },
);

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!key) return <>{children}</>;
  return <LazyPostHogProvider>{children}</LazyPostHogProvider>;
}
