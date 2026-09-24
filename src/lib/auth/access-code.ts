import "server-only";
import { randomInt } from "node:crypto";

// Shared by the per-student parent code and the course-wide board code.
// Same unambiguous alphabet as the course code (no 0/O, 1/I/L), but drawn
// with a CSPRNG: these codes alone are what stand between a stranger and
// the data behind them, so Math.random isn't good enough here.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomAccessCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += CHARSET[randomInt(CHARSET.length)];
  }
  return out;
}

// accepts the code typed with or without the dash, in any case
export function normalizeAccessCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}
