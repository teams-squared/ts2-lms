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

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
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
