import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { prismaRoleToApp } from "./types";
import { writeAuditLog } from "./audit";

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
              if (!user || !user.passwordHash) {
                await writeAuditLog({
                  action: "session.login_failed",
                  actorEmail: email,
                  targetType: "session",
                  metadata: { provider: "credentials", reason: "no_user_or_password" },
                });
                return null;
              }

              const valid = await bcrypt.compare(password, user.passwordHash);
              if (!valid) {
                await writeAuditLog({
                  action: "session.login_failed",
                  actorId: user.id,
                  actorEmail: user.email,
                  targetType: "session",
                  targetId: user.id,
                  metadata: { provider: "credentials", reason: "bad_password" },
                });
                return null;
              }

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
              // NOTE: do NOT set offboardedAt here — a routine login must not
              // auto-reactivate an offboarded user. Only the explicit reactivate
              // endpoint (/api/admin/users/[userId]/offboard DELETE) clears it.
            },
            create: {
              email: user.email,
              name: user.name ?? null,
              avatar,
              role: "EMPLOYEE",
            },
            select: { id: true, role: true, avatar: true, offboardedAt: true },
          });

          // Block offboarded users from obtaining a session.
          // Offboarded M365 users normally can't SSO (their Entra account is
          // disabled), but this stops stale tokens from remaining valid and
          // prevents the upsert above from silently resurrecting them as active
          // if their Entra account is somehow still live.
          if (dbUser.offboardedAt != null) {
            // Returning the token WITHOUT setting id/role keeps the session
            // callback from emitting a valid user identity. NextAuth v5 jwt
            // callback: if token.id is never set the session.user.id will be
            // empty and middleware / requireRole will treat the request as
            // unauthenticated.
            return token;
          }

          token.id = dbUser.id;
          token.role = prismaRoleToApp(dbUser.role);
          token.picture = dbUser.avatar ?? null;
          // Internal = admin or holds >= 1 clearance. Drives internal-docs nav
          // visibility; the route gate re-checks live so a fresh grant isn't
          // locked out before the next login.
          const clearanceCount = await prisma.userClearance.count({
            where: { userId: dbUser.id },
          });
          token.internal = dbUser.role === "ADMIN" || clearanceCount > 0;
          // Audit successful sign-in. This block runs only on initial login
          // (NextAuth passes `user` once), not on every token refresh.
          await writeAuditLog({
            action: "session.login",
            actorId: dbUser.id,
            actorEmail: user.email,
            targetType: "session",
            targetId: dbUser.id,
            metadata: { provider: account?.provider ?? "credentials" },
          });
        } catch (err) {
          console.error("[auth] jwt callback DB error:", err);
          token.role = "employee";
        }
      }
      return token;
    },
  },
});
