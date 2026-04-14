import "dotenv/config";
import { PrismaClient, Role, CourseStatus, LessonType } from "@prisma/client";
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
  {
    email: "admin@teamssquared.com",
    name: "Admin User",
    password: "admin123",
    role: Role.ADMIN,
  },
  {
    email: "manager@teamssquared.com",
    name: "Manager User",
    password: "manager123",
    role: Role.MANAGER,
  },
  {
    email: "employee@teamssquared.com",
    name: "Employee User",
    password: "employee123",
    role: Role.EMPLOYEE,
  },
  {
    email: "sarah@teamssquared.com",
    name: "Sarah Admin",
    password: "admin123",
    role: Role.ADMIN,
  },
  {
    email: "carol@teamssquared.com",
    name: "Carol Manager",
    password: "manager123",
    role: Role.MANAGER,
  },
];

const DEMO_COURSES = [
  {
    title: "Introduction to Cybersecurity",
    description:
      "Learn the fundamentals of cybersecurity including threat landscapes, common vulnerabilities, and best practices for protecting digital assets.",
    status: CourseStatus.PUBLISHED,
  },
  {
    title: "Cloud Infrastructure Essentials",
    description:
      "Understand core cloud concepts, AWS/Azure basics, and infrastructure-as-code principles for modern IT teams.",
    status: CourseStatus.PUBLISHED,
  },
  {
    title: "Leadership & Team Management",
    description:
      "Develop your leadership skills with practical frameworks for managing remote teams and driving results.",
    status: CourseStatus.PUBLISHED,
  },
  {
    title: "Advanced Networking (Draft)",
    description:
      "Deep dive into network architecture, routing protocols, and enterprise networking patterns.",
    status: CourseStatus.DRAFT,
  },
];

async function main() {
  // Seed users
  for (const user of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
      },
    });
    console.log(`Upserted ${user.email} (${user.role})`);
  }

  // Seed courses (attributed to admin user)
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@teamssquared.com" },
  });
  if (adminUser) {
    for (const course of DEMO_COURSES) {
      const existing = await prisma.course.findFirst({
        where: { title: course.title },
      });
      if (!existing) {
        await prisma.course.create({
          data: {
            title: course.title,
            description: course.description,
            status: course.status,
            createdById: adminUser.id,
          },
        });
        console.log(`Created course: ${course.title} (${course.status})`);
      } else {
        console.log(`Course already exists: ${course.title}`);
      }
    }
  }

  // Seed modules and lessons for published courses
  const COURSE_CONTENT: Record<
    string,
    { title: string; lessons: { title: string; type: LessonType; content: string | null }[] }[]
  > = {
    "Introduction to Cybersecurity": [
      {
        title: "Foundations of Security",
        lessons: [
          {
            title: "What is Cybersecurity?",
            type: LessonType.TEXT,
            content:
              "# What is Cybersecurity?\n\nCybersecurity is the practice of protecting systems, networks, and programs from digital attacks. These cyberattacks are usually aimed at accessing, changing, or destroying sensitive information.\n\n## Key Concepts\n\n- **Confidentiality** — ensuring information is only accessible to authorized parties\n- **Integrity** — ensuring data hasn't been tampered with\n- **Availability** — ensuring systems are accessible when needed\n\nThis triad (CIA) forms the foundation of all cybersecurity practice.",
          },
          {
            title: "Threat Landscape Overview",
            type: LessonType.VIDEO,
            content: "https://www.youtube.com/embed/inWWhr5tnEA",
          },
          {
            title: "Security Fundamentals Quiz",
            type: LessonType.QUIZ,
            content: null,
          },
        ],
      },
      {
        title: "Common Vulnerabilities",
        lessons: [
          {
            title: "OWASP Top 10",
            type: LessonType.TEXT,
            content:
              "# OWASP Top 10\n\nThe OWASP Top 10 is a standard awareness document for web application security. It represents a broad consensus about the most critical security risks.\n\n## The List\n\n1. Broken Access Control\n2. Cryptographic Failures\n3. Injection\n4. Insecure Design\n5. Security Misconfiguration\n6. Vulnerable Components\n7. Authentication Failures\n8. Data Integrity Failures\n9. Logging Failures\n10. Server-Side Request Forgery\n\nEach of these categories will be explored in detail throughout this module.",
          },
          {
            title: "Social Engineering Attacks",
            type: LessonType.TEXT,
            content:
              "# Social Engineering\n\nSocial engineering is the art of manipulating people into giving up confidential information. The types of information these criminals are seeking can vary.\n\n## Common Techniques\n\n- **Phishing** — fraudulent emails appearing to be from reputable sources\n- **Pretexting** — creating a fabricated scenario to engage a victim\n- **Baiting** — offering something enticing to the victim\n- **Tailgating** — following authorized personnel into restricted areas",
          },
        ],
      },
    ],
    "Cloud Infrastructure Essentials": [
      {
        title: "Cloud Fundamentals",
        lessons: [
          {
            title: "Introduction to Cloud Computing",
            type: LessonType.TEXT,
            content:
              "# Introduction to Cloud Computing\n\nCloud computing is the on-demand delivery of IT resources over the Internet with pay-as-you-go pricing.\n\n## Service Models\n\n- **IaaS** — Infrastructure as a Service (e.g., EC2, Azure VMs)\n- **PaaS** — Platform as a Service (e.g., Heroku, Azure App Service)\n- **SaaS** — Software as a Service (e.g., Gmail, Slack)\n\n## Deployment Models\n\n- Public cloud\n- Private cloud\n- Hybrid cloud",
          },
          {
            title: "Cloud Providers Comparison",
            type: LessonType.VIDEO,
            content: "https://www.youtube.com/embed/M988_fsOSWo",
          },
        ],
      },
      {
        title: "Infrastructure as Code",
        lessons: [
          {
            title: "Terraform Basics",
            type: LessonType.TEXT,
            content:
              "# Terraform Basics\n\nTerraform is an infrastructure as code tool that lets you define both cloud and on-prem resources in human-readable configuration files.\n\n## Core Workflow\n\n1. **Write** — define resources in `.tf` files\n2. **Plan** — preview changes before applying\n3. **Apply** — provision the infrastructure\n\n```hcl\nresource \"aws_instance\" \"example\" {\n  ami           = \"ami-0c55b159cbfafe1f0\"\n  instance_type = \"t2.micro\"\n}\n```",
          },
          {
            title: "IaC Best Practices",
            type: LessonType.TEXT,
            content:
              "# IaC Best Practices\n\n- Version control all infrastructure code\n- Use modules for reusable components\n- Implement state locking for team collaboration\n- Apply the principle of least privilege\n- Use variables and outputs for flexibility",
          },
          {
            title: "Infrastructure Quiz",
            type: LessonType.QUIZ,
            content: null,
          },
        ],
      },
    ],
    "Leadership & Team Management": [
      {
        title: "Leadership Foundations",
        lessons: [
          {
            title: "Leadership Styles",
            type: LessonType.TEXT,
            content:
              "# Leadership Styles\n\nUnderstanding different leadership styles helps you adapt your approach to different situations.\n\n## Key Styles\n\n- **Transformational** — inspires change through vision\n- **Servant** — focuses on serving the team's needs\n- **Democratic** — involves the team in decision-making\n- **Situational** — adapts style based on context",
          },
          {
            title: "Building Trust in Teams",
            type: LessonType.VIDEO,
            content: "https://www.youtube.com/embed/AL9DKAdqQBk",
          },
        ],
      },
      {
        title: "Remote Team Management",
        lessons: [
          {
            title: "Effective Remote Communication",
            type: LessonType.TEXT,
            content:
              "# Effective Remote Communication\n\n## Principles\n\n- Default to asynchronous communication\n- Over-communicate context and decisions\n- Use video for complex discussions\n- Document everything in shared spaces\n- Respect timezone differences",
          },
          {
            title: "Remote Management Quiz",
            type: LessonType.QUIZ,
            content: null,
          },
        ],
      },
    ],
  };

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

  for (const [courseTitle, modules] of Object.entries(COURSE_CONTENT)) {
    const course = await prisma.course.findFirst({ where: { title: courseTitle } });
    if (!course) continue;

    // Check if modules already exist for this course
    const existingModules = await prisma.module.count({ where: { courseId: course.id } });
    if (existingModules > 0) {
      console.log(`Modules already exist for: ${courseTitle}`);
      continue;
    }

    for (let mi = 0; mi < modules.length; mi++) {
      const mod = modules[mi];
      const createdModule = await prisma.module.create({
        data: {
          title: mod.title,
          order: mi + 1,
          courseId: course.id,
        },
      });
      console.log(`  Created module: ${mod.title}`);

      for (let li = 0; li < mod.lessons.length; li++) {
        const lesson = mod.lessons[li];
        await prisma.lesson.create({
          data: {
            title: lesson.title,
            type: lesson.type,
            content: lesson.content,
            order: li + 1,
            moduleId: createdModule.id,
          },
        });
        console.log(`    Created lesson: ${lesson.title} (${lesson.type})`);
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
