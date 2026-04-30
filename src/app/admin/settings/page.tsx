import { redirect } from "next/navigation";

/**
 * Legacy admin/settings route — its only contents (ISO ack recipients)
 * moved to /admin/emails alongside the new invite-email template editor.
 * Permanent redirect so any bookmarks keep working.
 */
export default function AdminSettingsPage() {
  redirect("/admin/emails");
}
