import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";
import type { Role } from "./types";

declare module "next-auth" {
  interface User {
    role?: Role;
  }
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      /**
       * Keys of docs unlocked this session, stored as "category/slug".
       * Lives inside the auth JWT so it is automatically cleared on sign-out.
       */
      unlockedDocs?: string[];
    };
  }
}

declare module "next-auth" {
  interface JWT {
    role?: Role;
    /** See Session.user.unlockedDocs */
    unlockedDocs?: string[];
  }
}

const providers: NextAuthConfig["providers"] = [];

if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    })
  );
}

// Edge-safe config: no Node.js-only imports (fs, path, bcryptjs, etc.)
// Credentials provider is added in auth.ts (Node.js context) where bcrypt is available.
// The session callback maps JWT token fields to session — safe for Edge.
export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as Role) || "employee";
        session.user.unlockedDocs =
          (token.unlockedDocs as string[] | undefined) ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
