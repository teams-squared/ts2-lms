import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL!;
const url = new URL(connectionString);
if (connectionString.includes("render.com")) {
  url.searchParams.set("sslmode", "require");
}
const adapter = new PrismaPg({ connectionString: url.toString() });
const prisma = new PrismaClient({ adapter });

const ACHIEVEMENTS = [
  // Onboarding
  { key: "first_login", title: "Welcome Aboard", description: "Log in for the first time", icon: "👋", xpReward: 10, category: "onboarding", threshold: 1 },
  { key: "first_enrollment", title: "Eager Learner", description: "Enroll in your first course", icon: "📚", xpReward: 15, category: "onboarding", threshold: 1 },
  // Lessons
  { key: "first_lesson", title: "First Steps", description: "Complete your first lesson", icon: "📖", xpReward: 20, category: "lessons", threshold: 1 },
  { key: "lessons_10", title: "Knowledge Seeker", description: "Complete 10 lessons", icon: "🎯", xpReward: 50, category: "lessons", threshold: 10 },
  { key: "lessons_25", title: "Dedicated Student", description: "Complete 25 lessons", icon: "📝", xpReward: 100, category: "lessons", threshold: 25 },
  { key: "lessons_50", title: "Lesson Master", description: "Complete 50 lessons", icon: "🏅", xpReward: 200, category: "lessons", threshold: 50 },
  // Quizzes
  { key: "first_quiz_pass", title: "Quiz Whiz", description: "Pass your first quiz", icon: "✅", xpReward: 25, category: "quizzes", threshold: 1 },
  { key: "perfect_quiz", title: "Perfect Score", description: "Score 100% on a quiz", icon: "💯", xpReward: 50, category: "quizzes", threshold: 1 },
  { key: "quizzes_5", title: "Quiz Champion", description: "Pass 5 quizzes", icon: "🧠", xpReward: 75, category: "quizzes", threshold: 5 },
  // Courses
  { key: "first_course_complete", title: "Graduate", description: "Complete your first course", icon: "🎓", xpReward: 100, category: "courses", threshold: 1 },
  { key: "courses_3", title: "Multi-Skilled", description: "Complete 3 courses", icon: "⭐", xpReward: 200, category: "courses", threshold: 3 },
  { key: "courses_10", title: "Course Conqueror", description: "Complete 10 courses", icon: "👑", xpReward: 500, category: "courses", threshold: 10 },
  // Streaks
  { key: "streak_3", title: "On a Roll", description: "Maintain a 3-day streak", icon: "🔥", xpReward: 30, category: "streaks", threshold: 3 },
  { key: "streak_7", title: "Week Warrior", description: "Maintain a 7-day streak", icon: "💪", xpReward: 75, category: "streaks", threshold: 7 },
  { key: "streak_30", title: "Unstoppable", description: "Maintain a 30-day streak", icon: "🚀", xpReward: 300, category: "streaks", threshold: 30 },
];

const DEMO_USERS = [
  { email: "admin@teamssquared.com", name: "Admin User", password: "admin123", role: Role.ADMIN },
  { email: "manager@teamssquared.com", name: "Manager User", password: "manager123", role: Role.MANAGER },
  { email: "employee@teamssquared.com", name: "Employee User", password: "employee123", role: Role.EMPLOYEE },
  { email: "sarah@teamssquared.com", name: "Sarah Admin", password: "admin123", role: Role.ADMIN },
  { email: "carol@teamssquared.com", name: "Carol Manager", password: "manager123", role: Role.MANAGER },
];

async function main() {
  // Seed demo users
  for (const user of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: { email: user.email, name: user.name, passwordHash, role: user.role },
    });
    console.log(`Upserted ${user.email} (${user.role})`);
  }

  // Seed achievements
  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
        category: achievement.category,
        threshold: achievement.threshold,
      },
      create: achievement,
    });
  }
  console.log(`Upserted ${ACHIEVEMENTS.length} achievements`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
