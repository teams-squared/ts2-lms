"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

/**
 * DashboardShell — design-system Section 8.6 / 8.8.
 *
 * The app chrome for all authenticated non-lesson pages:
 * - Left: collapsible primary sidebar (264px / 64px)
 * - Right: top bar (64px, sticky) + scrollable main content
 *
 * The shell short-circuits on /login (no session) and when there is no
 * session — mimicking the previous NavBar behavior, so logged-out pages
 * render their own full-bleed layout.
 *
 * The lesson player uses LessonPlayerShell instead (three-column variant).
 */

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Never render chrome on the login route or while unauthenticated.
  const suppressChrome =
    pathname === "/login" || status === "unauthenticated" || !session;

  if (suppressChrome) {
    return <>{children}</>;
  }

  // Lesson-player pages get a slim top bar (no search) so the lesson content
  // dominates the viewport. See design-system §8.6.
  const isLessonPlayer = /^\/courses\/[^/]+\/lessons\/[^/]+/.test(pathname ?? "");

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Skip-to-content link — required by §10 (keyboard accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar slim={isLessonPlayer} />
        <main
          id="main-content"
          className={cn(
            "flex-1",
            // Page content supplies its own padding; the shell only provides
            // vertical rhythm against the top bar.
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
