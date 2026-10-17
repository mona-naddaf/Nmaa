import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { familyEnabled } from "./enabled";
import { CHILD_COOKIE_NAME, CHILD_COOKIE_PATH, CHILD_SESSION_DAYS, signChildToken, verifyChildToken, type ChildTokenPayload } from "./child-token";

// A child's «العائلة» session (name + رمز, src/app/family/login). The token
// carries only the child's id and code version. Valid only while «العائلة» is
// on, the row is still a CHILD of an existing family, she still has a رمز and
// its version matches — a new رمز, «إيقاف الدخول», deleting the child or the
// family ends every open session on its next request.

export async function createChildSession(payload: ChildTokenPayload) {
  const store = await cookies();
  store.set(CHILD_COOKIE_NAME, await signChildToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CHILD_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * CHILD_SESSION_DAYS,
  });
}

export async function destroyChildSession() {
  const store = await cookies();
  // expire it at the same path it was set on — delete(name) targets path "/"
  store.set(CHILD_COOKIE_NAME, "", { path: CHILD_COOKIE_PATH, maxAge: 0 });
}

export type ChildSession = {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  familyId: string;
  familyName: string;
};

/** The signed-in child, or null. One lookup per request (cached). */
export const getFamilyChild = cache(async (): Promise<ChildSession | null> => {
  if (!familyEnabled()) return null;
  const store = await cookies();
  const raw = store.get(CHILD_COOKIE_NAME)?.value;
  if (!raw) return null;
  const payload = await verifyChildToken(raw);
  if (!payload) return null;
  const child = await prisma.rafiqUser.findUnique({
    where: { id: payload.uid },
    select: { kind: true, name: true, gender: true, childCode: true, childCodeVersion: true, family: { select: { id: true, name: true } } },
  });
  if (!child || child.kind !== "CHILD" || !child.family || !child.childCode || child.childCodeVersion !== payload.v) return null;
  return { id: payload.uid, name: child.name ?? "", gender: child.gender, familyId: child.family.id, familyName: child.family.name };
});

export async function requireFamilyChild(): Promise<ChildSession> {
  const child = await getFamilyChild();
  if (!child) redirect(familyEnabled() ? "/family/login" : "/");
  return child;
}
