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
    });
    initialized = true;
  }
}

export function PostHogProviderInner({ children }: { children: React.ReactNode }) {
  if (!initialized) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
