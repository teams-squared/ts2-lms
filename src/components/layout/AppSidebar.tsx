"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import { UserAvatar } from "@/components/ui";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  BookOpenIcon,
  ShieldIcon,
  HomeIcon,
  SignOutIcon,
  HamburgerIcon,
  CloseIcon,
} from "@/components/icons";
import { posthog } from "@/lib/posthog-client";
import { isNavActive } from "@/lib/navigation";

// ─── Nav link ─────────────────────────────────────────────────────────────────

function NavLink({
  href,
  icon: Icon,
  label,
  onNavigate,
  pathname,
}: {
  href: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  onNavigate?: () => void;
  pathname: string;
}) {
  const active = isNavActive(href, pathname);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400",
        active
          ? "border-l-[3px] border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 pl-[9px] pr-3 py-2.5"
          : "border-l-[3px] border-transparent text-gray-600 dark:text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-gray-200 px-3 py-2.5",
      ].join(" ")}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

// ─── Shared nav items (used in both desktop + mobile) ─────────────────────────

function NavItems({
  status,
  role,
  pathname,
  onNavigate,
}: {
  status: string;
  role?: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <NavLink href="/" icon={HomeIcon} label="Home" pathname={pathname} onNavigate={onNavigate} />
      {status === "authenticated" && (
        <NavLink
          href="/docs"
          icon={BookOpenIcon}
          label="Documentation"
          pathname={pathname}
          onNavigate={onNavigate}
        />
      )}
      {status === "authenticated" && role === "admin" && (
        <NavLink
          href="/admin"
          icon={ShieldIcon}
          label="Admin"
          pathname={pathname}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function AppSidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change or Escape key
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen]);

  if (pathname === "/login") return null;
  if (pathname === "/" && status !== "authenticated") return null;

  const userRole = session?.user?.role as string | undefined;

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 bg-[#f0eeff] dark:bg-[#17141f] border-b border-brand-100/80 dark:border-[#2c2838]">
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
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="Mobile navigation"
            className="relative flex flex-col w-64 h-full bg-[#f0eeff] dark:bg-[#17141f] border-r border-brand-100/80 dark:border-[#2c2838] shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-brand-100/60 dark:border-[#2c2838] flex-shrink-0">
              <Link href="/" onClick={() => setDrawerOpen(false)}>
                <Logo size={28} showText />
              </Link>
              <button
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-black/5 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/10 transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Nav */}
            <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              <NavItems
                status={status}
                role={userRole}
                pathname={pathname}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>

            {/* User */}
            {status === "authenticated" && session?.user && (
              <div className="px-3 pb-4 pt-3 border-t border-brand-100/60 dark:border-[#2c2838] flex-shrink-0 space-y-1">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.04]">
                  <UserAvatar name={session.user.name} email={session.user.email} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
                      {session.user.name || session.user.email}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 dark:text-brand-400 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                      {session.user.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    posthog.capture("user_logged_out");
                    posthog.reset();
                    signOut({ callbackUrl: "/" });
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <SignOutIcon className="w-4 h-4 flex-shrink-0" />
                  Sign out
                </button>
              </div>
            )}
          </nav>
        </div>
      )}

      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col flex-shrink-0 w-[220px] h-screen sticky top-0 bg-[#f0eeff] dark:bg-[#17141f] border-r border-brand-100/80 dark:border-[#2c2838]">

        {/* Logo row */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-brand-100/60 dark:border-[#2c2838] flex-shrink-0">
          <Link href="/" className="flex items-center min-w-0">
            <Logo size={28} showText />
          </Link>
          <ThemeToggle />
        </div>

        {/* Navigation */}
        <nav className="px-3 pt-5 pb-2 space-y-0.5" aria-label="Main navigation">
          <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600 select-none">
            Menu
          </p>
          <NavItems status={status} role={userRole} pathname={pathname} />
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User section */}
        {status === "authenticated" && session?.user && (
          <div className="px-3 pb-4 pt-3 border-t border-brand-100/60 dark:border-[#2c2838] flex-shrink-0 space-y-1">
            {/* User card */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.04]">
              <UserAvatar name={session.user.name} email={session.user.email} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
                  {session.user.name || session.user.email}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 dark:text-brand-400 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                  {session.user.role}
                </span>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={() => {
                posthog.capture("user_logged_out");
                posthog.reset();
                signOut({ callbackUrl: "/" });
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <SignOutIcon className="w-4 h-4 flex-shrink-0" />
              Sign out
            </button>
          </div>
        )}

        {/* Copyright */}
        <div className="px-4 py-3 border-t border-brand-100/60 dark:border-[#2c2838] flex-shrink-0">
          <p className="text-[10px] text-gray-400 dark:text-gray-600">
            &copy; {new Date().getFullYear()} Teams Squared
          </p>
        </div>
      </aside>
    </>
  );
}
