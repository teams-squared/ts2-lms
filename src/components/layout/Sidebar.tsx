"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home,
  GraduationCap,
  Shield,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";

/**
 * Sidebar — design-system Section 8.6 (primary navigation).
 *
 * Width: 264px expanded, 64px collapsed. bg-surface + border-right.
 * Items: 40px tall, rounded-md. Active state uses bg-primary-subtle +
 * 3px primary accent bar on the left edge (pseudo-element).
 *
 * Collapsible state is persisted to localStorage (key: "sidebar-collapsed").
 * Collapse toggle sits at the bottom of the sidebar.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If true, require admin or course_manager role. */
  manage?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/admin", label: "Admin", icon: Shield, manage: true },
];

interface SidebarProps {
  /** Exposed so the shell can adjust its own left-padding to match. */
  onCollapseChange?: (collapsed: boolean) => void;
  className?: string;
}

export function Sidebar({ onCollapseChange, className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored === "true") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    onCollapseChange?.(collapsed);
    try {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed, mounted, onCollapseChange]);

  const canManage =
    session?.user?.role === "admin" || session?.user?.role === "course_manager";

  const visibleItems = NAV_ITEMS.filter((i) => !i.manage || canManage);

  return (
    <aside
      aria-label="Primary"
      className={cn(
        "sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[264px]",
        className,
      )}
    >
      {/* Logo / brand row — 64px to align with top bar */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label="Teams Squared home"
        >
          <Logo size={28} showText={!collapsed} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    active &&
                      "bg-primary-subtle text-primary-subtle-foreground font-medium before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle — bottom breathing room per §8.6 */}
      <div className="border-t border-border px-2 pt-2 pb-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-foreground-muted transition-colors",
            "hover:bg-surface-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <>
              <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
