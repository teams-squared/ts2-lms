import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Allow external HTTPS images (user-provided thumbnails)
      "img-src 'self' data: blob: https:",
      // Allow YouTube/Vimeo video embeds, SharePoint PDF proxy, and PostHog dashboard embeds
      "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://us.posthog.com https://eu.posthog.com",
      // Allow self + MS Graph/login + PostHog ingestion
      "connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com https://us.i.posthog.com https://us-assets.i.posthog.com https://us.posthog.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    // Thumbnails are user-provided external URLs — allow any HTTPS host
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
