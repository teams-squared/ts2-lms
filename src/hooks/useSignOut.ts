"use client";

import { signOut, type SignOutParams } from "next-auth/react";
import posthog from "posthog-js";
import { useCallback } from "react";

/**
 * Sign out wrapper that resets PostHog's distinct ID before next-auth's
 * signOut redirect, so post-logout events aren't still tagged with the
 * previous user.
 */
export function useSignOut() {
  return useCallback(async (options?: SignOutParams) => {
    if (posthog.__loaded) {
      posthog.reset();
    }
    return signOut(options);
  }, []);
}
