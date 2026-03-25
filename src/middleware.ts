import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect /docs and /admin routes
  if (pathname.startsWith("/docs") || pathname.startsWith("/admin")) {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Admin page requires admin role
  if (pathname.startsWith("/admin")) {
    const role = req.auth?.user?.role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/docs", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/docs/:path*", "/admin/:path*"],
};
