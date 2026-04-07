"use client";

/**
 * Browser-side Application Insights singleton.
 *
 * Import this in any client component that needs to emit custom events.
 * The singleton is initialised lazily on first call to getAppInsights(),
 * so it is safe to import even when the connection string is not set.
 */

import { ApplicationInsights } from "@microsoft/applicationinsights-web";

let _ai: ApplicationInsights | null = null;

export function getAppInsights(): ApplicationInsights | null {
  if (typeof window === "undefined") return null; // SSR guard

  const connectionString =
    process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) return null;

  if (!_ai) {
    _ai = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: true,
        disableFetchTracking: false,
        disableAjaxTracking: false,
      },
    });
    _ai.loadAppInsights();
  }

  return _ai;
}

/** Track a custom browser-side event. No-op if SDK is not configured. */
export function trackBrowserEvent(
  name: string,
  properties: Record<string, string> = {}
): void {
  try {
    getAppInsights()?.trackEvent({ name, properties });
  } catch {
    // Telemetry failures must never affect the user experience
  }
}
