// Account rules for «رفيق الحفظ», shared by the server actions (which enforce
// them) and the forms (which only mirror them). Pure: no DB, no server-only
// imports.

export const ACCOUNT_LIMITS = {
  passwordMin: 8,
  // bcrypt only reads the first 72 bytes; longer would silently be ignored
  passwordMaxBytes: 72,
  nameMax: 40,
  emailMax: 254,
} as const;

export type RafiqGender = "MALE" | "FEMALE";

export function normalizeEmail(raw: unknown): string {
  return (typeof raw === "string" ? raw : "").trim().toLowerCase();
}

/** A plausible address (the real check is reaching it, once email exists). */
export function validEmail(email: string): boolean {
  return email.length <= ACCOUNT_LIMITS.emailMax && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** An error message, or null when the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < ACCOUNT_LIMITS.passwordMin) {
    return `يُرجى اختيار كلمة مرور لا تقل عن ${ACCOUNT_LIMITS.passwordMin} خانات`;
  }
  if (new TextEncoder().encode(password).length > ACCOUNT_LIMITS.passwordMaxBytes) {
    return "كلمة المرور طويلة جدًا، يُرجى اختيار كلمة أقصر";
  }
  return null;
}

/** Cleaned optional name: null when empty, or an error message. */
export function cleanName(raw: unknown): { name: string | null } | { error: string } {
  const name = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim();
  if (!name) return { name: null };
  if (name.length > ACCOUNT_LIMITS.nameMax) return { error: `يُرجى ألّا يزيد الاسم على ${ACCOUNT_LIMITS.nameMax} حرفًا` };
  return { name };
}

export function parseGender(raw: unknown): RafiqGender | null {
  return raw === "MALE" || raw === "FEMALE" ? raw : null;
}

// typed by her to confirm deleting the account
export const DELETE_CONFIRM_WORD = "حذف";

// her follow-up tracker: at most this many items in use at once
export const RAFIQ_TRACKER_MAX_ITEMS = 30;
