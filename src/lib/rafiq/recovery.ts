import "server-only";
import { randomInt } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";

// The recovery رمز: her only way back in if she forgets her password, until
// the site can send email. 16 characters from the same unambiguous alphabet
// as the other رموز (no 0/O, 1/I/L), drawn with a CSPRNG, shown once, and
// stored only as a bcrypt hash. Using it to set a new password replaces it.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 16;

export function randomRecoveryCode(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    if (i > 0 && i % 4 === 0) out += "-";
    out += CHARSET[randomInt(CHARSET.length)];
  }
  return out;
}

/** Accepts it typed with or without dashes, in any case. */
export function normalizeRecoveryCode(raw: unknown): string {
  const compact = (typeof raw === "string" ? raw : "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === LENGTH ? compact.match(/.{4}/g)!.join("-") : compact;
}

/** A fresh code, and what to store for it. */
export async function newRecoveryCode(): Promise<{ code: string; data: { recoveryCodeHash: string; recoveryCodeCreatedAt: Date } }> {
  const code = randomRecoveryCode();
  return { code, data: { recoveryCodeHash: await hashPassword(code), recoveryCodeCreatedAt: new Date() } };
}
