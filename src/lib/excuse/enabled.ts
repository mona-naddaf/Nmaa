// «أيام العذر» is switched on per environment (EXCUSE_ENABLED=1), so it can
// be built and merged step by step without showing up on the live site
// before it's ready. While off: no switch, button, item setting or «معذورة»
// anywhere (courses, «رفيق الحفظ», «العائلة»), every excuse action refuses,
// and stored excuses are ignored — scores, streaks and goals are exactly as
// before. No DB and no server-only imports, so the proxy can use it.
export function excuseEnabled(): boolean {
  return process.env.EXCUSE_ENABLED === "1";
}

/** EXCUSE_ALLOW_EMAILS: emails separated by commas, spaces or new lines → trimmed + lowercased (Rafiq stores them so). */
export function parseAllowList(raw: string | undefined): Set<string> | null {
  if (raw === undefined) return null;
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * While it is tried out on the live site: with EXCUSE_ALLOW_EMAILS set, only
 * the «رفيق الحفظ» accounts listed there have it (an empty list: nobody);
 * unset, everyone does. A child (no email) never does through this list.
 */
export function excuseAllowed(email: string | null | undefined): boolean {
  if (!excuseEnabled()) return false;
  const list = parseAllowList(process.env.EXCUSE_ALLOW_EMAILS);
  if (list === null) return true;
  return !!email && list.has(email.trim().toLowerCase());
}
