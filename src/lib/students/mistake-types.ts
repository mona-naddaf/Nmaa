import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// Client-safe labels for word-level recitation mistakes (RecitationMistake).

export type MistakeType = "PRONUNCIATION" | "TAJWEED" | "FORGOT_PROMPTED" | "HESITATED_SELF_CORRECTED";

/** Picker order. */
export const MISTAKE_TYPES: MistakeType[] = ["PRONUNCIATION", "TAJWEED", "FORGOT_PROMPTED", "HESITATED_SELF_CORRECTED"];

/** The label for a mistake type, conjugated for the student's group. */
export function mistakeTypeLabel(type: MistakeType, g: GroupGender): string {
  switch (type) {
    case "PRONUNCIATION":
      return "خطأ تشكيل";
    case "TAJWEED":
      return "خطأ تجويد";
    case "FORGOT_PROMPTED":
      return pickByGroup(g, { m: "تم ردّه", f: "تم ردّها" });
    case "HESITATED_SELF_CORRECTED":
      return pickByGroup(g, { m: "تعثّر وصحح بنفسه", f: "تعثّرت وصححت بنفسها" });
  }
}

/** One word on a student's active list: every unresolved flag on it, merged. */
export interface ActiveMistake {
  surahNumber: number;
  ayah: number;
  wordPosition: number;
  wordText: string;
  /** the type from the most recent flag */
  type: MistakeType;
  /** how many unresolved flags this word has */
  count: number;
  /** "YYYY-MM-DD" of the earliest unresolved flag */
  firstFlagged: string;
}
