"use client";

import { useState, type ReactNode } from "react";
import styles from "./home-log.module.css";
import { SegmentPractice, type SegmentActions } from "./SegmentPractice";
import type { WordFlags } from "@/components/mistakes/FlaggableAyah";
import type { HomeSegmentView } from "@/lib/home-log/data";
import type { MistakeType } from "@/lib/students/mistake-types";
import type { GroupGender } from "@/lib/text/gender";

type MarkAction = (input: { segmentId: string; ayah: number; wordPosition: number; type: MistakeType | null }) => Promise<{ error?: string }>;

// The practice screen with self-marked mistakes: the ayat's words can be
// tapped and marked; each pick shows at once and is saved right away (and
// put back if the server refuses). Shared by the course student and «رفيق
// الحفظ», each with its own server action.
export function PracticeWithMarks({
  segment,
  groupGender,
  actions,
  listHref,
  initialFlags,
  mark,
  afterAyah,
}: {
  segment: HomeSegmentView;
  groupGender: GroupGender;
  actions: SegmentActions;
  listHref: string;
  initialFlags: WordFlags;
  mark: MarkAction;
  afterAyah?: (ayah: number) => ReactNode;
}) {
  const [flags, setFlags] = useState<WordFlags>(initialFlags);
  const [error, setError] = useState<string | null>(null);

  function onFlag(key: string, type: MistakeType | null) {
    const before = flags;
    const next = { ...flags };
    if (type) next[key] = type;
    else delete next[key];
    setFlags(next);
    setError(null);
    const [, ayah, wordPosition] = key.split(":").map(Number);
    mark({ segmentId: segment.id, ayah, wordPosition, type }).then((r) => {
      if (r.error) {
        setFlags(before);
        setError(r.error);
      }
    });
  }

  const self = groupGender === "GIRLS" ? "FEMALE" : "MALE";
  const p = (m: string, f: string) => (groupGender === "GIRLS" ? f : m);
  const hint = `🔖 ${p("اضغط", "اضغطي")} على أي كلمة ${p("أخطأتَ", "أخطأتِ")} فيها لتحديدها، ثم ${p("علّمها", "علّميها")} متقَنة حين ${p("تتقنها", "تتقنينها")}. لا يرى هذه الكلمات أحد غيرك.`;
  return (
    <>
      {error && (
        <div className={styles.err} role="alert" style={{ margin: "0 4px 10px" }}>
          {error}
        </div>
      )}
      <SegmentPractice
        segment={segment}
        groupGender={groupGender}
        actions={actions}
        listHref={listHref}
        marking={{ flags, onFlag, subject: { self }, hint }}
        afterAyah={afterAyah}
      />
    </>
  );
}
