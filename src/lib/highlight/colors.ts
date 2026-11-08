// «التظليل»: the fixed palette. A highlight stores a key of it, never a raw
// colour. Soft colours that keep the text readable and stay apart from the
// mistake colours (copper, green, brick, grey), the tajweed blue and the
// copper similar-verse numbers. The default is a highlighter yellow, clearly
// visible on the cream background.

export const HIGHLIGHT_COLORS = {
  yellow: { label: "أصفر", band: "#f7dc6f", swatch: "#f2cf45" },
  sky: { label: "سماوي", band: "#cfe2f6", swatch: "#9cc3ea" },
  lavender: { label: "خزامى", band: "#e3d9f4", swatch: "#bba6e3" },
  pink: { label: "وردي", band: "#f8d5e2", swatch: "#eca6c1" },
  sand: { label: "رملي", band: "#eedcb8", swatch: "#d8bb83" },
  aqua: { label: "فيروزي", band: "#c8ecea", swatch: "#86d0cb" },
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;
export const HIGHLIGHT_COLOR_KEYS = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];
export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

export function isHighlightColor(v: unknown): v is HighlightColor {
  return typeof v === "string" && Object.hasOwn(HIGHLIGHT_COLORS, v);
}
