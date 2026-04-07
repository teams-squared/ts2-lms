import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { getUserRole } from "./roles";
import type { Role } from "./types";

// NextAuth v5 requires AUTH_SECRET to sign session tokens.
// In production, fail loudly rather than fall back to a known string.
if (!process.env.AUTH_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET environment variable is required in production.");
  }
  process.env.AUTH_SECRET = "dev-only-secret-change-in-production";
}

// Demo users for local development (when Azure AD is not configured).
// Passwords are bcrypt hashes — never store plain-text passwords.
const DEMO_USERS = [
  {
    id: "1",
    email: "admin@teamssquared.com",
    name: "Admin User",
    passwordHash: "$2b$10$L6zwYSrmwx8e3.pAv/U5eOgGBa4lEXU6i00.9e0qEgmrZVLrN8gBW",
  },
  {
    id: "2",
    email: "manager@teamssquared.com",
    name: "Manager User",
    passwordHash: "$2b$10$brGntn51.msXEyx8R9gENuQsmyLtyV1yavpONpZFR3UT18bvF6yd.",
  },
  {
    id: "3",
    email: "employee@teamssquared.com",
    name: "Employee User",
    passwordHash: "$2b$10$f7YPyfQLRgtCcv30djChMuh0CMI8kNBi7OKdTAvYkU6lJYbwBxK96",
  },
  {
    id: "4",
    email: "sarah@teamssquared.com",
    name: "Sarah Admin",
    passwordHash: "$2b$10$L6zwYSrmwx8e3.pAv/U5eOgGBa4lEXU6i00.9e0qEgmrZVLrN8gBW",
  },
  {
    id: "5",
    email: "carol@teamssquared.com",
    name: "Carol Manager",
    passwordHash: "$2b$10$brGntn51.msXEyx8R9gENuQsmyLtyV1yavpONpZFR3UT18bvF6yd.",
  },
];

// Full auth config with Node.js-only callbacks (role lookup uses fs, bcrypt uses crypto).
// Middleware uses authConfig directly (Edge-safe). Server components and
// API routes use this file.
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

        const user = DEMO_USERS.find((u) => u.email === email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        // user is only present on initial sign-in, not on token refreshes
        const role =
          (user as { role?: Role }).role ||
          (await getUserRole(user.email || ""));
        token.role = role;
      }
      return token;
    },
  },
});
