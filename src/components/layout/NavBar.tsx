"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import Logo from "@/components/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { HomeIcon, GraduationCapIcon, ShieldIcon, HamburgerIcon, CloseIcon, SignOutIcon } from "@/components/icons";

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (pathname === "/login") return null;
  if (!session) return null;

  const isAdmin = session.user?.role === "admin";
  const isManager = session.user?.role === "manager";

  const navLinks = [
    { href: "/", label: "Home", icon: HomeIcon },
    { href: "/courses", label: "Courses", icon: GraduationCapIcon },
    ...(isManager ? [{ href: "/manager", label: "Manager", icon: GraduationCapIcon }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldIcon }] : []),
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200/80 dark:border-[#2e2e3a] bg-white/80 dark:bg-[#141418]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Logo + nav links */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Logo size={28} showText />
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/30"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: notifications + theme toggle + user menu */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="Open user menu"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
              >
                <UserAvatar name={session.user?.name} size="sm" />
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {session.user?.name?.split(" ")[0]}
                </span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 z-50 w-56 rounded-xl border border-gray-200 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-elevated py-1">
                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-[#2e2e3a]">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {session.user?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {session.user?.email}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e1e28] transition-colors"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <SignOutIcon className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <HamburgerIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-100 dark:border-[#2e2e3a] bg-white dark:bg-[#141418] px-4 py-3 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1e1e28]"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
