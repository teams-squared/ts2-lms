"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import Logo from "@/components/Logo";

export default function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex-shrink-0">
            <Logo size={32} />
          </Link>

          <div className="hidden md:flex items-center gap-5">
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
            >
              Home
            </Link>
            {session && (
              <Link
                href="/docs"
                className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
              >
                Documentation
              </Link>
            )}
            {session?.user?.role === "admin" && (
              <Link
                href="/admin"
                className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
              >
                Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <>
                <span className="text-sm text-gray-500">
                  {session.user?.name || session.user?.email}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  {session.user?.role}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-2 space-y-1">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50"
            >
              Home
            </Link>
            {session && (
              <Link
                href="/docs"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50"
              >
                Documentation
              </Link>
            )}
            {session?.user?.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-gray-50"
              >
                Admin
              </Link>
            )}
            <div className="border-t border-gray-100 pt-2 mt-1">
              {session ? (
                <>
                  <div className="px-3 py-1.5 text-sm text-gray-500">
                    {session.user?.name || session.user?.email}
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      {session.user?.role}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white text-center"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
