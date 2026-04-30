/**
 * One-time cleanup: delete the demo accounts that the old prisma/seed.ts
 * planted into prod on every Render deploy.
 *
 * Usage (no extra installs needed):
 *
 *   1. From the Render dashboard, copy the External Connection String for
 *      ts2-lms-db (Database → Connect → "External Database URL").
 *
 *   2. Run a dry-run / preview first:
 *
 *        DATABASE_URL="<paste>" npx tsx scripts/delete-demo-users.ts
 *
 *      The script will list the demo accounts it found and any rows
 *      that block deletion (RESTRICT-onDelete foreign keys: namely
 *      Course.createdById and PolicyDocLesson.lastSyncedById). If any
 *      such blockers exist, it stops and tells you to re-run with a
 *      reassignment target.
 *
 *   3. To reassign blockers and delete in one go, set REASSIGN_TO_EMAIL
 *      to the email of a real admin who should inherit the orphaned
 *      courses / policy-doc-syncs. Example:
 *
 *        DATABASE_URL="…" REASSIGN_TO_EMAIL="akil@teamsquared.io" \
 *          npx tsx scripts/delete-demo-users.ts
 *
 * Safety:
 * - Only deletes accounts whose email is in the explicit DEMO_EMAILS
 *   list (the typo'd seed domain @teamssquared.com). Real
 *   @teamsquared.io users are NEVER touched.
 * - Reassignment only updates rows currently owned by demo users.
 * - The reassignment target must already exist and have role
 *   admin or course_manager.
 * - User row deletion cascades to Enrollment, LessonProgress,
 *   QuizAttempt, QuizAnswer, Notification, DeadlineReminderLog,
 *   UserStats, UserAchievement.
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

  const reassignToEmail = process.env.REASSIGN_TO_EMAIL?.trim().toLowerCase();

  // Match the TLS handling the rest of the codebase uses for managed
  // Postgres (self-signed certs on internal CAs).
  const url = new URL(raw);
  const isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(url.hostname);
  if (!isLocal) url.searchParams.set("sslmode", "no-verify");
  const adapter = new PrismaPg({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter });

  console.log(`\nConnected to ${url.hostname}\n`);

  // ── 1. Find demo accounts ────────────────────────────────────────────────
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

  const userIds = matches.map((m) => m.id);

  // ── 2. Detect RESTRICT-onDelete foreign keys that would block delete ────
  // Course.createdById and PolicyDocLesson.lastSyncedById both block User
  // deletion when referenced. Show counts; offer to reassign.
  const [coursesOwned, policyDocSyncs] = await Promise.all([
    prisma.course.findMany({
      where: { createdById: { in: userIds } },
      select: { id: true, title: true, createdById: true },
    }),
    prisma.policyDocLesson.findMany({
      where: { lastSyncedById: { in: userIds } },
      select: { lessonId: true, documentTitle: true, lastSyncedById: true },
    }),
  ]);

  // ── 3. Cascade preview (informational) ──────────────────────────────────
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

  if (coursesOwned.length > 0 || policyDocSyncs.length > 0) {
    console.log(`\nBlocking RESTRICT references that need reassignment:`);
    if (coursesOwned.length > 0) {
      console.log(`  · ${coursesOwned.length} course(s) owned (Course.createdById):`);
      for (const c of coursesOwned) {
        console.log(`      - "${c.title}"`);
      }
    }
    if (policyDocSyncs.length > 0) {
      console.log(`  · ${policyDocSyncs.length} policy-doc sync record(s) (PolicyDocLesson.lastSyncedById):`);
      for (const p of policyDocSyncs) {
        console.log(`      - "${p.documentTitle}"`);
      }
    }

    if (!reassignToEmail) {
      console.log(
        `\nRe-run with REASSIGN_TO_EMAIL=<your-admin-email> to transfer these to a real admin and proceed with deletion. Example:\n\n` +
          `    DATABASE_URL="…" REASSIGN_TO_EMAIL="akil@teamsquared.io" \\\n` +
          `      npx tsx scripts/delete-demo-users.ts\n`,
      );
      await prisma.$disconnect();
      process.exit(2);
    }

    // Validate the reassign target.
    const target = await prisma.user.findUnique({
      where: { email: reassignToEmail },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!target) {
      console.error(
        `\n✗ REASSIGN_TO_EMAIL=${reassignToEmail} not found in the User table. Aborting.\n`,
      );
      await prisma.$disconnect();
      process.exit(3);
    }
    if (target.role !== "ADMIN" && target.role !== "COURSE_MANAGER") {
      console.error(
        `\n✗ ${target.email} has role ${target.role}; need ADMIN or COURSE_MANAGER to inherit course ownership. Aborting.\n`,
      );
      await prisma.$disconnect();
      process.exit(4);
    }

    console.log(`\nReassigning to: ${target.email} (${target.role})`);

    if (coursesOwned.length > 0) {
      const cu = await prisma.course.updateMany({
        where: { createdById: { in: userIds } },
        data: { createdById: target.id },
      });
      console.log(`  · Course.createdById → ${cu.count} row(s) reassigned`);
    }
    if (policyDocSyncs.length > 0) {
      const pu = await prisma.policyDocLesson.updateMany({
        where: { lastSyncedById: { in: userIds } },
        data: { lastSyncedById: target.id },
      });
      console.log(`  · PolicyDocLesson.lastSyncedById → ${pu.count} row(s) reassigned`);
    }
  }

  // ── 4. Delete demo users ────────────────────────────────────────────────
  console.log(`\nDeleting demo users…`);
  const result = await prisma.user.deleteMany({
    where: { email: { in: DEMO_EMAILS } },
  });
  console.log(`Deleted ${result.count} user row(s).`);

  // ── 5. Verify ───────────────────────────────────────────────────────────
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
