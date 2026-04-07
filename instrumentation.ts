export async function register() {
  // Only run on the Node.js server runtime (not in Edge runtime or browser)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!connectionString) {
      console.warn(
        "[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING is not set — telemetry disabled."
      );
      return;
    }

    const appInsights = await import("applicationinsights");
    appInsights.default
      .setup(connectionString)
      // Auto-collect all inbound HTTP requests and their durations
      .setAutoCollectRequests(true)
      // Auto-capture unhandled exceptions
      .setAutoCollectExceptions(true)
      // Auto-collect CPU, memory, and GC performance counters
      .setAutoCollectPerformance(true, true)
      // Auto-track outbound HTTP calls (Graph API, SharePoint, etc.)
      .setAutoCollectDependencies(true)
      // Disable console log collection (too noisy for an internal tool)
      .setAutoCollectConsole(false)
      .start();

    console.log("[telemetry] Azure Application Insights initialised.");
  }
}
