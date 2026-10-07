// «رفيق الحفظ» is switched on per environment (RAFIQ_ENABLED=1) so it can be
// built and merged phase by phase without showing up on the live site before
// it's ready. While off: no home-page card, every /rafiq page redirects home
// (src/proxy.ts), and every Rafiq action and page refuses. No DB and no
// server-only imports, so the proxy and the home page can both use it.
export function rafiqEnabled(): boolean {
  return process.env.RAFIQ_ENABLED === "1";
}
