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

// Password / email login is opt-in via env flag so prod (where every user
// signs in through Entra SSO) carries zero password-auth attack surface:
// no /api/auth/callback/credentials, no bcrypt path, no enumeration risk.
// Staging and local dev set ALLOW_PASSWORD_LOGIN=true so devs + the
// Playwright e2e suite can sign in without an Entra tenant.
export const PASSWORD_LOGIN_ENABLED =
  process.env.ALLOW_PASSWORD_LOGIN === "true";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    ...(PASSWORD_LOGIN_ENABLED
      ? [
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
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      if (user?.email) {
        try {
          // Fetch profile photo from Microsoft Graph API on SSO login
          let avatar: string | null = null;
          if (account?.access_token && account.provider === "microsoft-entra-id") {
            try {
              const photoRes = await fetch(
                "https://graph.microsoft.com/v1.0/me/photos/48x48/$value",
                { headers: { Authorization: `Bearer ${account.access_token}` } },
              );
              if (photoRes.ok) {
                const buf = Buffer.from(await photoRes.arrayBuffer());
                const contentType = photoRes.headers.get("content-type") || "image/jpeg";
                avatar = `data:${contentType};base64,${buf.toString("base64")}`;
              }
            } catch {
              // Photo fetch failed — not critical, fall back to initials
            }
          }

          // Upsert SSO users on first login, then read their role.
          // Must happen here (not in events.signIn) so the role is available
          // before the token is signed.
          const dbUser = await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name ?? undefined,
              ...(avatar ? { avatar } : {}),
            },
            create: {
              email: user.email,
              name: user.name ?? null,
              avatar,
              role: "EMPLOYEE",
            },
            select: { id: true, role: true, avatar: true },
          });
          token.id = dbUser.id;
          token.role = prismaRoleToApp(dbUser.role);
          token.picture = dbUser.avatar ?? null;
        } catch (err) {
          console.error("[auth] jwt callback DB error:", err);
          token.role = "employee";
        }
      }
      return token;
    },
  },
});
