import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { rafiqEnabled } from "./enabled";
import {
  RAFIQ_COOKIE_NAME,
  RAFIQ_COOKIE_PATH,
  RAFIQ_SESSION_DAYS,
  signRafiqToken,
  verifyRafiqToken,
  type RafiqTokenPayload,
} from "./token";

// «رفيق الحفظ» sessions: the token carries only the user's id and session
// version. Valid only while the feature is on, the account exists and the
// version still matches — a password change or reset, «الخروج من جميع
// الأجهزة», or deleting the account ends every open session on its next
// request. Every Rafiq page and action gets the user from here, and every
// Rafiq query is scoped by this id: nobody else's data is ever reachable.

export async function createRafiqSession(payload: RafiqTokenPayload) {
  const store = await cookies();
  store.set(RAFIQ_COOKIE_NAME, await signRafiqToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: RAFIQ_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * RAFIQ_SESSION_DAYS,
  });
}

export async function destroyRafiqSession() {
  const store = await cookies();
  // expire it at the same path it was set on — delete(name) targets path "/"
  store.set(RAFIQ_COOKIE_NAME, "", { path: RAFIQ_COOKIE_PATH, maxAge: 0 });
}

export type RafiqUserSession = {
  id: string;
  email: string;
  name: string | null;
  gender: "MALE" | "FEMALE";
  sessionVersion: number;
};

/** The signed-in Rafiq user, or null. One lookup per request (cached). */
export const getRafiqUser = cache(async (): Promise<RafiqUserSession | null> => {
  if (!rafiqEnabled()) return null;
  const store = await cookies();
  const raw = store.get(RAFIQ_COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = await verifyRafiqToken(raw);
  if (!payload) return null;

  const user = await prisma.rafiqUser.findUnique({
    where: { id: payload.uid },
    select: { id: true, email: true, name: true, gender: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== payload.v) return null;
  return user;
});

export async function requireRafiqUser(): Promise<RafiqUserSession> {
  const user = await getRafiqUser();
  if (!user) redirect(rafiqEnabled() ? "/rafiq/login" : "/");
  return user;
}
