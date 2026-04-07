"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { posthog } from "@/lib/posthog-client";

export default function PageViewTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (session?.user?.email) {
      posthog.identify(session.user.email, {
        name: session.user.name ?? "",
        role: session.user.role ?? "",
      });
    } else if (session === null) {
      posthog.reset();
    }

    posthog.capture("$pageview", {
      $current_url: window.location.href,
    });
  }, [pathname, session]);

  return null;
}
