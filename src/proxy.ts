import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth/session";
import { PARENT_COOKIE_NAME, verifyParentToken } from "@/lib/auth/parent-token";
import { BOARD_COOKIE_NAME, verifyBoardToken } from "@/lib/auth/board-token";
import { STUDENT_COOKIE_NAME, verifyStudentToken } from "@/lib/auth/student-token";
import { RAFIQ_COOKIE_NAME, verifyRafiqToken } from "@/lib/rafiq/token";
import { rafiqEnabled } from "@/lib/rafiq/enabled";

// Settings, parent codes and the student archive are supervisor-only.
// (Every page and action re-checks as well.)
const ADMIN_ONLY_PATHS = ["/settings", "/students/parent-codes", "/students/archive", "/parent-codes"];

type Area = {
  base: string;
  cookie: string;
  verify: (raw: string) => Promise<unknown>;
  // pages under base reachable without a session (always includes /login)
  publicPages?: string[];
  // when false, the whole area is closed and redirects home
  enabled?: () => boolean;
};

const CODE_AREAS: Area[] = [
  { base: "/parent", cookie: PARENT_COOKIE_NAME, verify: verifyParentToken },
  { base: "/board", cookie: BOARD_COOKIE_NAME, verify: verifyBoardToken },
  // note: "/students" (staff) is not this area — only "/student" and "/student/…"
  { base: "/student", cookie: STUDENT_COOKIE_NAME, verify: verifyStudentToken },
  // «رفيق الحفظ»: its own email + password accounts (src/lib/rafiq)
  { base: "/rafiq", cookie: RAFIQ_COOKIE_NAME, verify: verifyRafiqToken, publicPages: ["signup", "recover"], enabled: rafiqEnabled },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Separate login areas (parent, public board, student, Rafiq): each handled
  // entirely on its own cookie and never falling through to the staff rules
  // below — a staff session grants nothing there, and their sessions grant
  // nothing anywhere else. (Each page also re-checks against the DB.)
  for (const area of CODE_AREAS) {
    if (pathname === area.base || pathname.startsWith(`${area.base}/`)) {
      if (area.enabled && !area.enabled()) return NextResponse.redirect(new URL("/", request.url));
      const publicPages = ["login", ...(area.publicPages ?? [])].map((p) => `${area.base}/${p}`);
      if (publicPages.includes(pathname)) return NextResponse.next();
      const raw = request.cookies.get(area.cookie)?.value;
      if (!raw || !(await area.verify(raw))) {
        return NextResponse.redirect(new URL(`${area.base}/login`, request.url));
      }
      return NextResponse.next();
    }
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  // Public entry points: the landing page and the staff login.
  if (pathname === "/" || pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/students", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session.role !== "admin" && ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/students", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // public brand files (tab/app icons, manifest) are served to everyone,
  // including logged-out visitors on the home and login pages
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|icons/).*)"],
};
