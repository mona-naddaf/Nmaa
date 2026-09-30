import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth/session";

// Where requireSession sends a staff session that's no longer valid (its
// teacher row was deleted, or it points at the supervisor's stand-in).
// Server components can't clear cookies themselves, so this route does,
// then returns to the homepage — which would otherwise bounce the still-set
// cookie straight back to /students.
export async function GET(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/", request.url));
}
