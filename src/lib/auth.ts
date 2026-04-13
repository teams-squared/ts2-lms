import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { prismaRoleToApp } from "./types";

if (!process.env.AUTH_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET environment variable is required in production.");
  }
  process.env.AUTH_SECRET = "dev-only-secret-change-in-production";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.email) {
        try {
          // Upsert SSO users on first login, then read their role.
          // Must happen here (not in events.signIn) so the role is available
          // before the token is signed.
          const dbUser = await prisma.user.upsert({
            where: { email: user.email },
            update: { name: user.name ?? undefined },
            create: {
              email: user.email,
              name: user.name ?? null,
              role: "EMPLOYEE",
            },
            select: { id: true, role: true },
          });
          token.id = dbUser.id;
          token.role = prismaRoleToApp(dbUser.role);
        } catch (err) {
          console.error("[auth] jwt callback DB error:", err);
          token.role = "employee";
        }
      }
      return token;
    },
  },
});
