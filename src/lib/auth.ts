import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserRole } from "./roles";
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
    };
  }
}

declare module "next-auth" {
  interface JWT {
    role?: Role;
  }
}

// Demo users for local development (when Azure AD is not configured)
const DEMO_USERS = [
  {
    id: "1",
    email: "admin@teamssquared.com",
    name: "Admin User",
    password: "admin123",
  },
  {
    id: "2",
    email: "manager@teamssquared.com",
    name: "Manager User",
    password: "manager123",
  },
  {
    id: "3",
    email: "employee@teamssquared.com",
    name: "Employee User",
    password: "employee123",
  },
];

const providers = [];

// Add Microsoft Entra ID provider if configured
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

// Always include credentials provider for development/fallback
providers.push(
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

      // In production, passwords would be hashed with bcrypt
      if (password !== user.password) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: getUserRole(user.email),
      };
    },
  })
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: Role }).role || getUserRole(user.email || "");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as Role) || "employee";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
