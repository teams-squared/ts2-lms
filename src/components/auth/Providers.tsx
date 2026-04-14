"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import PostHogProvider from "@/components/analytics/PostHogProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <ThemeProvider>
        <SessionProvider>{children}</SessionProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
