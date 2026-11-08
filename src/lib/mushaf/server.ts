import "server-only";
import { prisma } from "@/lib/db";
import { getRafiqUser } from "@/lib/rafiq/session";
import { mushafViewFor, type MushafConfig } from "./enabled";

/** «صفحة المصحف» for the signed-in Rafiq user (her own pages, or an adult on a child's pages). */
export async function mushafForRafiqUser(): Promise<MushafConfig | undefined> {
  const user = await getRafiqUser();
  return user ? mushafViewFor(user.email) : undefined;
}

/** «صفحة المصحف» on a child's own pages: a child has no email, so her family's founder's decides. */
export async function mushafForFamily(familyId: string): Promise<MushafConfig | undefined> {
  if (!process.env.MUSHAF_VIEW_EMAILS?.trim()) return undefined;
  const f = await prisma.family.findUnique({ where: { id: familyId }, select: { founder: { select: { email: true } } } });
  return f ? mushafViewFor(f.founder.email) : undefined;
}
