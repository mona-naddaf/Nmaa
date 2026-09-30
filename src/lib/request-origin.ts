import "server-only";
import { headers } from "next/headers";

/**
 * The site's own address as the current visitor reached it, e.g.
 * "https://alamukth.vercel.app" — so printed sheets and copyable links match
 * the domain in use (the old vercel.app hosts redirect to the main one, see
 * next.config.ts). null when the request carries no host.
 */
export async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
