import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MarkingDetail } from "@/components/admin/MarkingDetail";

export const dynamic = "force-dynamic";

export default async function AdminMarkingDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "course_manager")
  ) {
    redirect("/");
  }

  const { submissionId } = await params;

  return (
    <div>
      <MarkingDetail submissionId={submissionId} />
    </div>
  );
}
