import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session || (role !== "admin" && role !== "manager" && role !== "instructor")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
          Manager Dashboard
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400">
          Manage your courses and track learner progress
        </p>
      </div>
      {children}
    </div>
  );
}
