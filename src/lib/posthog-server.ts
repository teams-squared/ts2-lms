import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

function getPostHog(): PostHog | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

/** Fire a PostHog event from a server-side API route. No-op if PostHog is not configured. */
export function trackEvent(userId: string, event: string, properties?: Record<string, unknown>) {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
}
