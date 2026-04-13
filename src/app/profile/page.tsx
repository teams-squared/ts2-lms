import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoleBadge } from "@/components/ui/Badge";
import { prismaRoleToApp } from "@/lib/types";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/login");

  const role = prismaRoleToApp(user.role);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-6">
        My Profile
      </h1>

      <div className="rounded-xl border border-gray-200/80 dark:border-[#2e2e3a] bg-white dark:bg-[#1c1c24] shadow-card overflow-hidden">
        <div className="p-6 flex items-center gap-5 border-b border-gray-100 dark:border-[#2e2e3a]">
          <UserAvatar name={user.name} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {user.name || "Unnamed User"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <div className="mt-2">
              <RoleBadge role={role} />
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-[#2e2e3a]">
          <div className="px-6 py-4 flex justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Account created
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {user.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="px-6 py-4 flex justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Last updated
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {user.updatedAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
