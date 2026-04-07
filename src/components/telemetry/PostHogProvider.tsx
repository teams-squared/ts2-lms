"use client";

import { PostHogProvider as PHProvider } from "posthog-js/react";
import { posthog } from "@/lib/posthog-client";

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
