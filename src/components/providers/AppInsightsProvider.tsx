"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getAppInsights } from "@/lib/browser-telemetry";

/**
 * Invisible client component that bootstraps the browser-side Application
 * Insights SDK and ties authenticated user identity to all telemetry.
 *
 * Mount once inside the root layout, inside the SessionProvider.
 */
export default function AppInsightsProvider() {
  const { data: session } = useSession();

  useEffect(() => {
    const ai = getAppInsights();
    if (!ai) return;

    const email = session?.user?.email;
    if (email) {
      // Associate all future browser telemetry with this authenticated user
      ai.setAuthenticatedUserContext(email, undefined, true);
    } else {
      ai.clearAuthenticatedUserContext();
    }
  }, [session]);

  // No visible UI
  return null;
}
