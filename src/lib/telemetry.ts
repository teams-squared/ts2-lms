/**
 * Server-side telemetry helpers for Azure Application Insights.
 *
 * All functions are no-ops when the App Insights SDK has not been initialised
 * (i.e. when APPLICATIONINSIGHTS_CONNECTION_STRING is not set), so they are
 * safe to call unconditionally in any server component or API route.
 */

type Properties = Record<string, string>;

function getClient() {
  try {
    // applicationinsights is a server-only package — dynamic require avoids
    // bundling it into client chunks.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ai = require("applicationinsights") as typeof import("applicationinsights");
    return ai.defaultClient ?? null;
  } catch {
    return null;
  }
}

/**
 * Track a named custom event with optional string properties.
 *
 * @example
 * trackEvent("doc_view", { category: "engineering", slug: "setup", userEmail: "a@ts2.com" });
 */
export function trackEvent(name: string, properties: Properties = {}): void {
  const client = getClient();
  client?.trackEvent({ name, properties });
}

/**
 * Track an exception. Useful in catch blocks inside API routes.
 */
export function trackException(error: Error, properties: Properties = {}): void {
  const client = getClient();
  client?.trackException({ exception: error, properties });
}
