import posthog from "posthog-js";

if (typeof window !== "undefined" && !posthog.__loaded) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2026-01-30",
    capture_pageview: false, // tracked manually via PageViewTracker
    capture_pageleave: true,
  });
}

export { posthog };
