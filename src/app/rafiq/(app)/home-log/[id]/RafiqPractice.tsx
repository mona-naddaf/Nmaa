"use client";

import type { ComponentProps } from "react";
import { PracticeWithMarks } from "@/components/home-log/PracticeWithMarks";
import { VerseNoteMarker } from "../../notes/NotesProvider";

// Her practice screen: the shared one, with a note marker after each verse.
export function RafiqPractice(props: Omit<ComponentProps<typeof PracticeWithMarks>, "afterAyah">) {
  const surah = props.segment.surahNumber;
  return <PracticeWithMarks {...props} afterAyah={(a) => <VerseNoteMarker surah={surah} ayah={a} />} />;
}
