import Link from "next/link";
import {
  GraduationCapIcon,
  UsersIcon,
  CheckCircleIcon,
  ShieldIcon,
  BookOpenIcon,
} from "@/components/icons";
import type { Role } from "@/lib/types";

interface QuickLinksRowProps {
  userRole: Role;
}

export function QuickLinksRow({ userRole }: QuickLinksRowProps) {
  const links: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    {
      href: userRole === "admin" ? "/courses" : "/courses?tab=my",
      icon: GraduationCapIcon,
      label: userRole === "admin" ? "Catalog" : "My Courses",
    },
    { href: "/profile", icon: UsersIcon, label: "Profile" },
    { href: "/profile/achievements", icon: CheckCircleIcon, label: "Achievements" },
  ];

  if (userRole === "admin") {
    links.push(
      { href: "/courses?tab=my", icon: BookOpenIcon, label: "My Courses" },
      { href: "/admin", icon: ShieldIcon, label: "Admin" },
    );
  }
  if (userRole === "manager" || userRole === "instructor") {
    links.push({
      href: "/manager",
      icon: BookOpenIcon,
      label: userRole === "instructor" ? "Teaching" : "Manager",
    });
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Quick Links
      </h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card hover-lift text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            <link.icon className="w-3.5 h-3.5" />
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
