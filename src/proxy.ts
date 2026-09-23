import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth/session";
import { PARENT_COOKIE_NAME, verifyParentToken } from "@/lib/auth/parent-token";

const ADMIN_ONLY_PATHS = ["/settings"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Parent area: handled entirely on its own cookie and never falls through
  // to the staff rules below — a staff session grants nothing here, and a
  // parent session grants nothing anywhere else. (The page itself also
  // re-checks the code version against the DB.)
  if (pathname === "/parent" || pathname.startsWith("/parent/")) {
    const parentToken = request.cookies.get(PARENT_COOKIE_NAME)?.value;
    const parent = parentToken ? await verifyParentToken(parentToken) : null;
    if (pathname === "/parent/login") return NextResponse.next();
    if (!parent) return NextResponse.redirect(new URL("/parent/login", request.url));
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  if (pathname === "/login") {
    if (session) {
      const dest = session.role === "admin" ? "/settings" : "/students";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.role !== "admin" && ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/students", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
