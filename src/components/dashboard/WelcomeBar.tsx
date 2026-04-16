import { RoleBadge } from "@/components/ui/Badge";
import type { Role } from "@/lib/types";

interface WelcomeBarProps {
  firstName: string;
  email: string;
  userRole: Role;
  xp: number;
  streak: number;
  completedCount: number;
}

export function WelcomeBar({
  firstName,
  email,
  userRole,
  xp,
  streak,
  completedCount,
}: WelcomeBarProps) {
  return (
    <div className="bg-brand-gradient-subtle animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Greeting */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate">
              Welcome back, {firstName}
            </h1>
            <RoleBadge role={userRole} />
          </div>

          {/* Stats chips */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
              {email}
            </span>
            {xp > 0 && (
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true">⚡</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {xp.toLocaleString()}
                </span>
                <span className="text-gray-500 dark:text-gray-400">XP</span>
              </div>
            )}
            {streak > 0 && (
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true">🔥</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {streak}
                </span>
                <span className="text-gray-500 dark:text-gray-400">day streak</span>
              </div>
            )}
            {completedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true">🎓</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {completedCount}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  complete
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
