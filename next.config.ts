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
      // Next.js inline scripts and RSC payloads require unsafe-inline/unsafe-eval in dev;
      // in production Turbopack inlines a nonce — keeping unsafe-inline for now is the
      // pragmatic choice until nonce-based CSP is wired through the app.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com",
      // Allow PostHog dashboard embeds
      "frame-src 'self' https://us.posthog.com https://eu.posthog.com",
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
};

export default nextConfig;
