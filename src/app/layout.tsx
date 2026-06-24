import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import Providers from "@/components/auth/Providers";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AmbientMotionGate } from "@/components/layout/AmbientMotionGate";
import PostHogIdentify from "@/components/analytics/PostHogIdentify";
import PostHogPageView from "@/components/analytics/PostHogPageView";
import "./globals.css";

// Inter — body / UI font (see design-system Section 4.1)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Plus Jakarta Sans — display / headings font (design-system Section 4.1).
// Exposed as `--font-jakarta`; `--font-display` (the Tailwind utility token)
// is composed in globals.css from this variable. Naming the next/font variable
// the same as the Tailwind token would create a circular CSS-var reference.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700"],
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://learn.teamsquared.io";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  // `template` applies to child segments: a page that sets `title: "Courses"`
  // renders as "Courses | Teams Squared LMS". `default` covers the root itself.
  title: {
    default: "Teams Squared LMS",
    template: "%s | Teams Squared LMS",
  },
  description: "Learning Management System for Teams Squared",
  applicationName: "Teams Squared LMS",
  // Authenticated-only app — keep it out of search indexes entirely.
  // Reinforced by src/app/robots.ts (Disallow: /).
  robots: { index: false, follow: false },
  openGraph: {
    title: "Teams Squared LMS",
    description: "Learning Management System for Teams Squared",
    siteName: "Teams Squared LMS",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Matches the light/dark --background tokens in globals.css so mobile
  // browser chrome blends with the app instead of the OS default.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground font-sans">
        {/* Skip-to-content for keyboard users (design-system §10). Hidden by
            default, becomes visible on focus. Targets DashboardShell's <main>. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Skip to content
        </a>
        <Providers>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <PostHogIdentify />
          <AmbientMotionGate />
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
