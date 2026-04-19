"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import PostHogProvider from "@/components/analytics/PostHogProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <ThemeProvider>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
