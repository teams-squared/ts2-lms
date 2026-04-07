"use client";

import { SessionProvider } from "next-auth/react";
import PostHogProvider from "@/components/telemetry/PostHogProvider";
import PageViewTracker from "@/components/telemetry/PageViewTracker";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostHogProvider>
        <PageViewTracker />
        {children}
      </PostHogProvider>
    </SessionProvider>
  );
}
