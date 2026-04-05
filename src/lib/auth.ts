import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { getUserRole } from "./roles";
import type { Role } from "./types";

// NextAuth v5 reads AUTH_SECRET; fall back to NEXTAUTH_SECRET or a dev-only placeholder
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET =
    process.env.NEXTAUTH_SECRET ||
    "dev-only-secret-change-in-production";
}

// Full auth config with Node.js-only callbacks (role lookup uses fs).
// Middleware uses authConfig directly (Edge-safe). Server components and
// API routes use this file.
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role =
          (user as { role?: Role }).role ||
          (await getUserRole(user.email || ""));
      }
      return token;
    },
  },
});
