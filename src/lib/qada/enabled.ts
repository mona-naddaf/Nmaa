import { parseAllowList } from "@/lib/excuse/enabled";

// «القضاء» while it's tried out: only the accounts in QADA_EMAILS (emails, or
// «*» for everyone; unset or empty: nobody). On a child's pages (the child
// herself, or an adult of her family) the family founder's email decides,
// and the child's own «القضاء» switch must be on too. Courses never get it.
// No DB and no server-only imports.
export function qadaAllowed(email: string | null | undefined): boolean {
  const list = parseAllowList(process.env.QADA_EMAILS);
  if (!list) return false;
  if (list.has("*")) return true;
  return !!email && list.has(email.trim().toLowerCase());
}
