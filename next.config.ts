import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js to leave these server-only packages as native Node.js requires
  // rather than bundling them. applicationinsights pulls in a large OpenTelemetry
  // dependency tree with optional peer packages that Turbopack cannot resolve
  // statically. Marking them external means they're loaded at runtime by Node.js
  // directly, which is correct since they never run in a browser or Edge runtime.
  serverExternalPackages: [
    "applicationinsights",
    "@azure/monitor-opentelemetry",
    "diagnostic-channel",
    "diagnostic-channel-publishers",
  ],
};

export default nextConfig;
