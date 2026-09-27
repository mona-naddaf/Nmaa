import { Amiri_Quran } from "next/font/google";

// Renders the Uthmani script of the Tanzil text correctly (superscript alef,
// small high marks, pause signs). Loaded only where Quran text is shown.
export const quranFont = Amiri_Quran({ weight: "400", subsets: ["arabic"], display: "swap" });
