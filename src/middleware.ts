import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = [
  "/admin",
  "/manage",
  "/department",
  "/departments",
  "/dashboard",
  "/calendar",
  "/my-schedule",
  "/notifications",
  "/profile",
  "/affirmations",
  "/seed",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected) {
    const sessionCookie = request.cookies.get("session");
    if (!sessionCookie) {
      // Remember where the user was going: if they're still signed in to
      // Firebase, the login page renews the session and sends them back.
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/login" || pathname === "/register") {
    const sessionCookie = request.cookies.get("session");
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/manage/:path*",
    "/department/:path*",
    "/departments/:path*",
    "/dashboard/:path*",
    "/calendar/:path*",
    "/my-schedule/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/affirmations/:path*",
    "/seed",
    "/login",
    "/register",
  ],
};
