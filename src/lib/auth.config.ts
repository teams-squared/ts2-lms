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
      /** Stable per-login identifier — regenerated on each sign-in so that
       *  doc-unlock cookies from a previous session are automatically invalidated. */
      loginId?: string;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    role?: Role;
    /** See Session.user.loginId */
    loginId?: string;
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
        // Prefer the UUID stamped at sign-in time (new sessions).
        // For sessions issued before loginId was introduced, derive a
        // stable binding from sub + iat — both are always present in the
        // JWT and change whenever a new token is issued (i.e. on sign-in).
        // This is read directly from the decoded token on every request, so
        // no write-back to the JWT cookie is needed.
        session.user.loginId =
          (token.loginId as string | undefined) ||
          `${token.sub ?? token.email}:${token.iat}`;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
