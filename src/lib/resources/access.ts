import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth/session";

// Who is looking at the bank. Resources and reports belong to a person
// (a supervisor account or a teacher row), never to a course.

export type Viewer = { kind: "admin"; adminId: string } | { kind: "teacher"; teacherId: string };

export function viewerOf(session: Session): Viewer {
  return session.role === "admin"
    ? { kind: "admin", adminId: session.adminId }
    : { kind: "teacher", teacherId: session.teacherId };
}

/** `data` for a new resource, and `where` for "resources this viewer created". */
export function createdBy(viewer: Viewer) {
  return viewer.kind === "admin" ? { createdByAdminId: viewer.adminId } : { createdByTeacherId: viewer.teacherId };
}

export function reportedBy(viewer: Viewer) {
  return viewer.kind === "admin" ? { reporterAdminId: viewer.adminId } : { reporterTeacherId: viewer.teacherId };
}

export function isCreator(viewer: Viewer, r: { createdByAdminId: string | null; createdByTeacherId: string | null }) {
  return viewer.kind === "admin" ? r.createdByAdminId === viewer.adminId : r.createdByTeacherId === viewer.teacherId;
}

// The site owner is a supervisor account whose email is listed in the
// SITE_OWNER_EMAILS environment variable (comma-separated). Nothing in the
// app or the database can grant it; unset means nobody is owner.
const ownerEmails = () =>
  (process.env.SITE_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const adminIsOwner = cache(async (adminId: string) => {
  const emails = ownerEmails();
  if (emails.length === 0) return false;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { email: true } });
  return !!admin && emails.includes(admin.email.toLowerCase());
});

export async function isSiteOwner(session: Session): Promise<boolean> {
  return session.role === "admin" && adminIsOwner(session.adminId);
}
