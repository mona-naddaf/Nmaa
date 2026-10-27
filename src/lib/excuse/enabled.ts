// «أيام العذر» is switched on per environment (EXCUSE_ENABLED=1), so it can
// be built and merged step by step without showing up on the live site
// before it's ready. While off: no switch, button, item setting or «معذورة»
// anywhere (courses, «رفيق الحفظ», «العائلة»), every excuse action refuses,
// and stored excuses are ignored — scores, streaks and goals are exactly as
// before. No DB and no server-only imports, so the proxy can use it.
export function excuseEnabled(): boolean {
  return process.env.EXCUSE_ENABLED === "1";
}
