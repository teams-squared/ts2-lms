import Link from "next/link";
import { auth } from "@/lib/auth";
import Logo from "@/components/Logo";
import { RoleBadge } from "@/components/ui/Badge";
import type { Role } from "@/lib/types";

export default async function HomePage() {
  const session = await auth();

  // Logged-out landing page
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#f5f5f8] dark:bg-[#0f0f14]">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex justify-center mb-2">
            <Logo size={48} showText={false} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Teams Squared{" "}
              <span className="text-brand-600 dark:text-brand-400">LMS</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sign in to access your learning platform.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-lg shadow-brand-600/25 text-sm"
          >
            Sign in
          </Link>
        </div>
        <p className="absolute bottom-6 text-xs text-gray-400 dark:text-gray-600">
          &copy; {new Date().getFullYear()} Teams Squared
        </p>
      </div>
    );
  }

  const userRole = (session.user?.role as Role) || "employee";
  const firstName = session.user?.name?.split(" ")[0] || "there";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-2">
          Welcome back, {firstName}
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {session.user?.email}
          </p>
          <RoleBadge role={userRole} />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/profile"
          className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated transition-shadow"
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            My Profile
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            View your account details and role
          </p>
        </Link>

        {userRole === "admin" && (
          <Link
            href="/admin"
            className="p-5 rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover:shadow-elevated transition-shadow"
          >
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Admin Dashboard
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage users and roles
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
