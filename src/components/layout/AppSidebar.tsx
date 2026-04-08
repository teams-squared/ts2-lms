"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useRef, useState, useEffect } from "react";
import Logo from "@/components/Logo";
import { UserAvatar } from "@/components/ui";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  BookOpenIcon,
  ShieldIcon,
  ChevronRightIcon,
  HomeIcon,
  SignOutIcon,
  HamburgerIcon,
  CloseIcon,
} from "@/components/icons";
import { posthog } from "@/lib/posthog-client";
import { isNavActive } from "@/lib/navigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const STORAGE_KEY = "sidebar-collapsed";

function NavLink({
  href,
  icon: Icon,
  label,
  showLabel = true,
  onNavigate,
  pathname,
}: {
  href: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  showLabel?: boolean;
  onNavigate?: () => void;
  pathname: string;
}) {
  const active = isNavActive(href, pathname);
  return (
    <Link
      href={href}
      title={!showLabel ? label : undefined}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 ${
        active
          ? "border-l-[3px] border-brand-500 bg-brand-50 text-brand-700 pl-[9px] pr-3 rounded-r-lg dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-400"
          : "border-l-[3px] border-transparent text-gray-600 hover:bg-black/5 hover:text-gray-900 px-3 rounded-lg dark:text-gray-400 dark:hover:bg-white/8 dark:hover:text-gray-200"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {showLabel && <span>{label}</span>}
    </Link>
  );
}

export default function AppSidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalStorage(STORAGE_KEY, false);
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen]);

  function toggle() {
    setCollapsed(!collapsed);
  }

  // Hide sidebar on auth pages
  if (pathname === "/login") return null;

  // Don't render width-dependent UI until mounted (avoid hydration flash)
  const w = mounted ? (collapsed ? 60 : 220) : 220;

  return (
    <>
      {/* ── Mobile header ──────────────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-[#f0eeff] dark:bg-[#17141f] border-b border-brand-100/80 dark:border-[#2c2838]">
        <Link href="/">
          <Logo size={28} showText />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            aria-label="Open navigation menu"
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-black/5 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <HamburgerIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <nav
            ref={drawerRef}
            aria-label="Mobile navigation"
            className="relative w-64 flex flex-col h-full bg-[#f0eeff] dark:bg-[#17141f] border-r border-brand-100/80 dark:border-[#2c2838] shadow-xl"
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-3 h-14 border-b border-brand-100/60 dark:border-[#2c2838] flex-shrink-0">
              <Link href="/" onClick={() => setDrawerOpen(false)}>
                <Logo size={28} showText />
              </Link>
              <button
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-black/5 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/10 transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
              <NavLink
                href="/"
                icon={HomeIcon}
                label="Home"
                onNavigate={() => setDrawerOpen(false)}
                pathname={pathname}
              />
              {status === "authenticated" && (
                <NavLink
                  href="/docs"
                  icon={BookOpenIcon}
                  label="Documentation"
                  onNavigate={() => setDrawerOpen(false)}
                  pathname={pathname}
                />
              )}
              {status === "authenticated" && session?.user?.role === "admin" && (
                <NavLink
                  href="/admin"
                  icon={ShieldIcon}
                  label="Admin"
                  onNavigate={() => setDrawerOpen(false)}
                  pathname={pathname}
                />
              )}
            </div>

            {/* User section */}
            {status === "authenticated" && (
              <div className="px-2 py-3 border-t border-brand-100/60 dark:border-[#2c2838] flex-shrink-0 space-y-1">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <UserAvatar name={session.user?.name} email={session.user?.email} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {session.user?.name || session.user?.email}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-brand-700 dark:text-brand-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                      {session.user?.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    posthog.capture("user_logged_out");
                    posthog.reset();
                    signOut({ callbackUrl: "/" });
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-black/5 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  <SignOutIcon className="w-4 h-4 flex-shrink-0" />
                  Sign Out
                </button>
              </div>
            )}

            {/* Copyright */}
            <div className="px-3 py-2 border-t border-brand-100/60 dark:border-[#2c2838] flex-shrink-0">
              <p className="text-[10px] text-gray-400 dark:text-gray-600">
                &copy; {new Date().getFullYear()} Teams Squared
              </p>
            </div>
          </nav>
        </div>
      )}

      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 bg-[#f0eeff] dark:bg-[#17141f] border-r border-brand-100/80 dark:border-[#2c2838] transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: `${w}px` }}
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-brand-100/60 dark:border-[#2c2838] flex-shrink-0">
          <Link href="/" className="flex items-center overflow-hidden min-w-0">
            {mounted && collapsed ? (
              <Logo size={28} showText={false} />
            ) : (
              <Logo size={28} showText />
            )}
          </Link>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Theme toggle — hide label in collapsed state */}
            {(!mounted || !collapsed) && <ThemeToggle />}
            <button
              onClick={toggle}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-black/5 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors"
            >
              <ChevronRightIcon
                className="w-4 h-4 transition-transform duration-200"
                style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
              />
            </button>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
          <NavLink
            href="/"
            icon={HomeIcon}
            label="Home"
            showLabel={!collapsed || !mounted}
            pathname={pathname}
          />
          {status === "authenticated" && (
            <NavLink
              href="/docs"
              icon={BookOpenIcon}
              label="Documentation"
              showLabel={!collapsed || !mounted}
              pathname={pathname}
            />
          )}
          {status === "authenticated" && session?.user?.role === "admin" && (
            <NavLink
              href="/admin"
              icon={ShieldIcon}
              label="Admin"
              showLabel={!collapsed || !mounted}
              pathname={pathname}
            />
          )}
        </nav>

        {/* User section */}
        {status === "authenticated" && (
          <div className="px-2 py-3 border-t border-brand-100/60 dark:border-[#2c2838] flex-shrink-0 space-y-1">
            <div
              className="flex items-center gap-2 px-3 py-1.5 overflow-hidden"
              title={collapsed ? (session.user?.name || session.user?.email || "") : undefined}
            >
              <UserAvatar name={session.user?.name} email={session.user?.email} />
              <div
                className="transition-[opacity,width] duration-150 overflow-hidden whitespace-nowrap min-w-0"
                style={
                  mounted
                    ? collapsed
                      ? { opacity: 0, width: 0 }
                      : { opacity: 1, width: "auto" }
                    : { opacity: 1, width: "auto" }
                }
              >
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {session.user?.name || session.user?.email}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-brand-700 dark:text-brand-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                  {session.user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                posthog.capture("user_logged_out");
                posthog.reset();
                signOut({ callbackUrl: "/" });
              }}
              title={collapsed ? "Sign Out" : undefined}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-black/5 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              <SignOutIcon className="w-4 h-4 flex-shrink-0" />
              <span
                className="transition-[opacity,width] duration-150 overflow-hidden whitespace-nowrap"
                style={
                  mounted
                    ? collapsed
                      ? { opacity: 0, width: 0 }
                      : { opacity: 1, width: "auto" }
                    : { opacity: 1, width: "auto" }
                }
              >
                Sign Out
              </span>
            </button>
          </div>
        )}

        {/* Collapsed state: show ThemeToggle at bottom */}
        {mounted && collapsed && (
          <div className="px-2 pb-3 flex justify-center flex-shrink-0">
            <ThemeToggle />
          </div>
        )}

        {/* Copyright */}
        <div
          className="px-3 py-2 border-t border-brand-100/60 dark:border-[#2c2838] flex-shrink-0 overflow-hidden"
          style={
            mounted
              ? collapsed
                ? { opacity: 0, height: 0, padding: 0 }
                : { opacity: 1 }
              : { opacity: 1 }
          }
        >
          <p className="text-[10px] text-gray-400 dark:text-gray-600 whitespace-nowrap">
            &copy; {new Date().getFullYear()} Teams Squared
          </p>
        </div>
      </aside>
    </>
  );
}
