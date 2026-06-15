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
      /** True when the user is an internal member (admin or holds >= 1
       *  clearance). Drives internal-docs nav visibility. Computed at login;
       *  the /internal-docs route gate re-checks live. */
      internal?: boolean;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    id?: string;
    role?: Role;
    picture?: string | null;
    internal?: boolean;
  }
}

// Session lifetime (ISO 27001 A.8.5 — secure authentication). JWT sessions are
// sliding: each request inside the window past `updateAge` re-issues the token
// and extends expiry, so `maxAge` acts as an idle timeout. Default 8h forces a
// fresh sign-in roughly once per working day; override via SESSION_MAX_AGE_SECONDS.
const SESSION_MAX_AGE_SECONDS = (() => {
  const raw = Number(process.env.SESSION_MAX_AGE_SECONDS);
  return Number.isInteger(raw) && raw > 0 ? raw : 8 * 60 * 60;
})();
const SESSION_UPDATE_AGE_SECONDS = 15 * 60; // re-issue token at most every 15 min

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

export const authConfig: NextAuthConfig = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || token.sub || "";
        session.user.role = (token.role as Role) || "employee";
        session.user.image = (token.picture as string) || null;
        session.user.internal = Boolean(token.internal);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  cookies: {
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
  },
};
