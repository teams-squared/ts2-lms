import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { getUserRole } from "./roles";
import type { Role } from "./types";

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
