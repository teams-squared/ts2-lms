/**
 * One-time cleanup: delete the demo accounts that the old prisma/seed.ts
 * planted into prod on every Render deploy.
 *
 * Usage:
 *   1. From the Render dashboard, copy the External Connection String for
 *      ts2-lms-db (Database → Connect → "External Database URL").
 *   2. Run from this repo's root, with that URL inline:
 *
 *        DATABASE_URL="<paste here>" npx tsx scripts/delete-demo-users.ts
 *
 *   3. The script previews matches, deletes them, then prints a final
 *      "remaining" count. Expect 0.
 *
 * Safety:
 * - Only deletes accounts whose email is in the explicit DEMO_EMAILS list.
 * - The seed used the typo'd domain @teamssquared.com (double-s); real
 *   @teamsquared.io users (your actual employees) are NEVER touched.
 * - User row deletion cascades to Enrollment, LessonProgress, QuizAttempt,
 *   QuizAnswer, Notification, DeadlineReminderLog, UserStats,
 *   UserAchievement (per the Prisma schema). The preview shows the count
 *   of those before the delete runs.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DEMO_EMAILS = [
  "admin@teamssquared.com",
  "manager@teamssquared.com",
  "employee@teamssquared.com",
  "sarah@teamssquared.com",
  "carol@teamssquared.com",
];

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL is not set. See file header for usage.");
    process.exit(1);
  }

  // Match the TLS handling the rest of the codebase uses for managed
  // Postgres (self-signed certs on internal CAs).
  const url = new URL(raw);
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(url.hostname);
  if (!isLocal) url.searchParams.set("sslmode", "no-verify");
  const adapter = new PrismaPg({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter });

  console.log(`\nConnected to ${url.hostname}\n`);

  // Preview
  const matches = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      createdAt: true,
    },
    orderBy: { email: "asc" },
  });

  if (matches.length === 0) {
    console.log("✓ No demo accounts found. Nothing to delete.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${matches.length} demo account(s):`);
  for (const u of matches) {
    console.log(
      `  · ${u.email.padEnd(32)} ${u.role.padEnd(15)} ${u.name ?? "(no name)"}`,
    );
  }

  // Cascade preview
  const userIds = matches.map((m) => m.id);
  const [enrollments, progress, attempts, notifications] = await Promise.all([
    prisma.enrollment.count({ where: { userId: { in: userIds } } }),
    prisma.lessonProgress.count({ where: { userId: { in: userIds } } }),
    prisma.quizAttempt.count({ where: { userId: { in: userIds } } }),
    prisma.notification.count({ where: { userId: { in: userIds } } }),
  ]);

  console.log(`\nCascading rows that will also be removed:`);
  console.log(`  · Enrollments:     ${enrollments}`);
  console.log(`  · Lesson progress: ${progress}`);
  console.log(`  · Quiz attempts:   ${attempts}`);
  console.log(`  · Notifications:   ${notifications}`);

  // Delete
  console.log(`\nDeleting…`);
  const result = await prisma.user.deleteMany({
    where: { email: { in: DEMO_EMAILS } },
  });
  console.log(`Deleted ${result.count} user row(s).`);

  // Verify
  const remaining = await prisma.user.count({
    where: { email: { contains: "@teamssquared.com" } },
  });
  if (remaining === 0) {
    console.log(`\n✓ Verification: 0 @teamssquared.com accounts remain.\n`);
  } else {
    console.log(
      `\n⚠ Verification: ${remaining} @teamssquared.com account(s) still present. Inspect manually.\n`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\nError:", err);
  process.exit(1);
});
