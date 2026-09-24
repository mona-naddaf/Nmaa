import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth/session";
import { PARENT_COOKIE_NAME, verifyParentToken } from "@/lib/auth/parent-token";
import { BOARD_COOKIE_NAME, verifyBoardToken } from "@/lib/auth/board-token";

const ADMIN_ONLY_PATHS = ["/settings"];

const CODE_AREAS = [
  { base: "/parent", cookie: PARENT_COOKIE_NAME, verify: verifyParentToken },
  { base: "/board", cookie: BOARD_COOKIE_NAME, verify: verifyBoardToken },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Code-only areas (parent, public board): each handled entirely on its own
  // cookie and never falling through to the staff rules below — a staff
  // session grants nothing there, and their sessions grant nothing anywhere
  // else. (Each page also re-checks the code version against the DB.)
  for (const area of CODE_AREAS) {
    if (pathname === area.base || pathname.startsWith(`${area.base}/`)) {
      if (pathname === `${area.base}/login`) return NextResponse.next();
      const raw = request.cookies.get(area.cookie)?.value;
      if (!raw || !(await area.verify(raw))) {
        return NextResponse.redirect(new URL(`${area.base}/login`, request.url));
      }
      return NextResponse.next();
    }
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
