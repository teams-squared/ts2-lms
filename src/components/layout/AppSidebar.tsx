"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { BookOpenIcon, ShieldIcon, ChevronRightIcon } from "@/components/icons";

const STORAGE_KEY = "sidebar-collapsed";

export default function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
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
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  // Hide sidebar on auth pages
  if (pathname === "/login") return null;

  // Don't render width-dependent UI until mounted (avoid hydration flash)
  const w = mounted ? (collapsed ? 60 : 220) : 220;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function NavLink({
    href,
    icon: Icon,
    label,
    showLabel = true,
    onNavigate,
  }: {
    href: string;
    icon: React.FC<{ className?: string }>;
    label: string;
    showLabel?: boolean;
    onNavigate?: () => void;
  }) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        title={!showLabel ? label : undefined}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 ${
          active
            ? "bg-brand-100 text-brand-800"
            : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {showLabel && <span>{label}</span>}
      </Link>
    );
  }

  return (
    <>
      {/* ── Mobile header ──────────────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-[#f0eeff] border-b border-brand-100">
        <Link href="/">
          <Logo size={28} showText />
        </Link>
        <button
          aria-label="Open navigation menu"
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-colors"
        >
          <HamburgerIcon className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <nav
            ref={drawerRef}
            aria-label="Mobile navigation"
            className="relative w-64 flex flex-col h-full bg-[#f0eeff] border-r border-brand-100 shadow-xl"
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-3 h-14 border-b border-brand-100/60 flex-shrink-0">
              <Link href="/" onClick={() => setDrawerOpen(false)}>
                <Logo size={28} showText />
              </Link>
              <button
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-colors"
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
              />
              {session && (
                <NavLink
                  href="/docs"
                  icon={BookOpenIcon}
                  label="Documentation"
                  onNavigate={() => setDrawerOpen(false)}
                />
              )}
              {session?.user?.role === "admin" && (
                <NavLink
                  href="/admin"
                  icon={ShieldIcon}
                  label="Admin"
                  onNavigate={() => setDrawerOpen(false)}
                />
              )}
            </div>

            {/* User section */}
            {session && (
              <div className="px-2 py-3 border-t border-brand-100/60 flex-shrink-0 space-y-1">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-brand-200 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-800">
                    {(session.user?.name || session.user?.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {session.user?.name || session.user?.email}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                      {session.user?.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-colors"
                >
                  <SignOutIcon className="w-4 h-4 flex-shrink-0" />
                  Sign Out
                </button>
              </div>
            )}

            {/* Copyright */}
            <div className="px-3 py-2 border-t border-brand-100/60 flex-shrink-0">
              <p className="text-[10px] text-gray-400">
                &copy; {new Date().getFullYear()} Teams Squared
              </p>
            </div>
          </nav>
        </div>
      )}

      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 bg-[#f0eeff] border-r border-brand-100 transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: `${w}px` }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-brand-100/60 flex-shrink-0">
          <Link href="/" className="flex items-center overflow-hidden">
            {mounted && collapsed ? (
              <Logo size={28} showText={false} />
            ) : (
              <Logo size={28} showText />
            )}
          </Link>
          <button
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-colors"
          >
            <ChevronRightIcon
              className="w-4 h-4 transition-transform duration-200"
              style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
            />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
          <NavLink
            href="/"
            icon={HomeIcon}
            label="Home"
            showLabel={!collapsed || !mounted}
          />
          {session && (
            <NavLink
              href="/docs"
              icon={BookOpenIcon}
              label="Documentation"
              showLabel={!collapsed || !mounted}
            />
          )}
          {session?.user?.role === "admin" && (
            <NavLink
              href="/admin"
              icon={ShieldIcon}
              label="Admin"
              showLabel={!collapsed || !mounted}
            />
          )}
        </nav>

        {/* User section */}
        {session && (
          <div className="px-2 py-3 border-t border-brand-100/60 flex-shrink-0 space-y-1">
            <div
              className="flex items-center gap-2 px-3 py-1.5 overflow-hidden"
              title={collapsed ? (session.user?.name || session.user?.email || "") : undefined}
            >
              <div className="w-6 h-6 rounded-full bg-brand-200 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-800">
                {(session.user?.name || session.user?.email || "?")[0].toUpperCase()}
              </div>
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
                <p className="text-xs font-medium text-gray-700 truncate">
                  {session.user?.name || session.user?.email}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                  {session.user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              title={collapsed ? "Sign Out" : undefined}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-colors"
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

        {/* Copyright */}
        <div
          className="px-3 py-2 border-t border-brand-100/60 flex-shrink-0 overflow-hidden"
          style={
            mounted
              ? collapsed
                ? { opacity: 0, height: 0, padding: 0 }
                : { opacity: 1 }
              : { opacity: 1 }
          }
        >
          <p className="text-[10px] text-gray-400 whitespace-nowrap">
            &copy; {new Date().getFullYear()} Teams Squared
          </p>
        </div>
      </aside>
    </>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
