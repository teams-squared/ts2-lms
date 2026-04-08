"use client";

import { SessionProvider } from "next-auth/react";
import PostHogProvider from "@/components/telemetry/PostHogProvider";
import PageViewTracker from "@/components/telemetry/PageViewTracker";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <PostHogProvider>
          <PageViewTracker />
          {children}
        </PostHogProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
