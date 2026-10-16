import "server-only";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { limited, record, TOO_MANY } from "./limits";

/**
 * Her current password is right (and she hasn't run out of attempts): null,
 * or the message to show. Every wrong guess counts against the per-account
 * limit. Used before changing the password or the recovery رمز, and before
 * deleting her account or a family she founded.
 */
export async function checkPassword(user: { id: string; email: string }, password: string): Promise<string | null> {
  if (await limited("account", user.email)) return TOO_MANY;
  const row = await prisma.rafiqUser.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row?.passwordHash || !(await verifyPassword(password, row.passwordHash))) {
    await record("account", user.email);
    return "كلمة المرور الحالية غير صحيحة";
  }
  return null;
}
