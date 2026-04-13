import { PrismaClient, Role } from "@prisma/client";
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

async function main() {
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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
