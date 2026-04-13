import { PrismaClient, Role, CourseStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
