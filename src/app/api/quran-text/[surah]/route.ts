import { NextRequest, NextResponse } from "next/server";
import { QURAN_TEXT_SOURCE, surahText } from "@/lib/quran-data/quran-text";

// One surah of the Tanzil Uthmani text, for the recitation form's word-level
// mistake flagging. Public (it's the Quran text, not student data) and
// immutable, so browsers and the CDN cache it indefinitely.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/quran-text/[surah]">) {
  const { surah } = await ctx.params;
  const n = Number(surah);
  const ayahs = Number.isInteger(n) ? surahText(n) : null;
  if (!ayahs) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(
    { surah: n, source: QURAN_TEXT_SOURCE, ayahs },
    { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
