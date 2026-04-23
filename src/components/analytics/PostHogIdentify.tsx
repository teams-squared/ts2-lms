"use client";

import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { useEffect } from "react";

export default function PostHogIdentify() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!posthog.__loaded) return;

    const userId = session?.user?.id;
    if (!userId) return;

    if (posthog.get_distinct_id() === userId) return;

    posthog.identify(userId, {
      email: session.user.email ?? undefined,
      role: session.user.role ?? undefined,
    });
  }, [status, session?.user?.id, session?.user?.email, session?.user?.role]);

  return null;
}
