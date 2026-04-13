"use client";

import { SessionProvider } from "next-auth/react";
import PostHogProvider from "@/components/telemetry/PostHogProvider";
import PageViewTracker from "@/components/telemetry/PageViewTracker";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ProgressProvider from "@/components/providers/ProgressProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ProgressProvider>
          <PostHogProvider>
            <PageViewTracker />
            {children}
          </PostHogProvider>
        </ProgressProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
