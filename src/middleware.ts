import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = [
  "/admin",
  "/manage",
  "/department",
  "/dashboard",
  "/calendar",
  "/my-schedule",
  "/notifications",
  "/profile",
  "/affirmations",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected) {
    const sessionCookie = request.cookies.get("session");
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
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
    "/dashboard/:path*",
    "/calendar/:path*",
    "/my-schedule/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/affirmations/:path*",
    "/login",
    "/register",
  ],
};
