"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

let initialized = false;
if (typeof window !== "undefined" && !initialized) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      // Disable auto-injected feature scripts (surveys, session-recording,
      // web-vitals, autocapture). posthog-js appends each as a <script>
      // inside the React tree, which trips React 19's "script tag while
      // rendering" warning. We don't use these features; keeping them off
      // also saves ~300 KB of runtime JS.
      //
      // Note: the dead-clicks-autocapture extension is controlled by the
      // PostHog project's *remote* Remote Config (captureDeadClicks), not
      // by the client init options. Turn it off in the PostHog dashboard
      // under Project Settings → Autocapture if its script warning is
      // undesirable. (posthog-js v1.368.0)
      disable_surveys: true,
      disable_session_recording: true,
      capture_performance: false,
      autocapture: false,
    });
    initialized = true;
  }
}

export function PostHogProviderInner({ children }: { children: React.ReactNode }) {
  if (!initialized) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
