export type DeadlineStatus = "none" | "completed" | "upcoming" | "due-soon" | "overdue";

export interface DeadlineInfo {
  deadlineDays: number | null;
  absoluteDeadline: string | null; // ISO string
  status: DeadlineStatus;
}

/** Add `deadlineDays` to an enrollment date to get the absolute deadline. */
export function computeDeadline(enrolledAt: Date, deadlineDays: number): Date {
  const d = new Date(enrolledAt);
  d.setDate(d.getDate() + deadlineDays);
  return d;
}

/**
 * Determine the deadline status for a lesson given enrollment context.
 * - `"none"` — no deadline configured
 * - `"completed"` — lesson finished (regardless of deadline)
 * - `"upcoming"` — deadline exists, > 24 h away, not completed
 * - `"due-soon"` — deadline exists, ≤ 24 h away, not completed
 * - `"overdue"` — deadline has passed, not completed
 */
export function getDeadlineStatus(
  enrolledAt: Date,
  deadlineDays: number | null,
  completedAt: Date | null,
): DeadlineStatus {
  if (deadlineDays == null) return "none";
  if (completedAt) return "completed";

  const deadline = computeDeadline(enrolledAt, deadlineDays);
  const now = new Date();
  const msLeft = deadline.getTime() - now.getTime();

  if (msLeft < 0) return "overdue";
  if (msLeft <= 24 * 60 * 60 * 1000) return "due-soon";
  return "upcoming";
}

/**
 * Human-readable relative string for a deadline date.
 * Examples: "Due tomorrow", "Due in 3 days", "Overdue by 2 days", "Due Apr 20"
 */
export function formatDeadlineRelative(deadline: Date): string {
  const now = new Date();
  const msLeft = deadline.getTime() - now.getTime();
  const hoursLeft = msLeft / (3_600_000);

  if (hoursLeft < 0) {
    const overdueDays = Math.max(1, Math.floor(Math.abs(hoursLeft) / 24));
    return overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`;
  }
  if (hoursLeft < 24) return "Due today";
  if (hoursLeft < 48) return "Due tomorrow";
  const daysLeft = Math.ceil(hoursLeft / 24);
  if (daysLeft <= 7) return `Due in ${daysLeft} days`;
  return `Due ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
