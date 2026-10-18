"use client";

import { useState, type ReactNode } from "react";
import styles from "./home-log.module.css";
import { SegmentPractice, type SegmentActions } from "./SegmentPractice";
import type { WordFlags } from "@/components/mistakes/FlaggableAyah";
import type { HomeSegmentView } from "@/lib/home-log/data";
import type { MistakeType } from "@/lib/students/mistake-types";
import type { GroupGender } from "@/lib/text/gender";
import type { RecitationSubject } from "@/lib/recitation/logic";
import { parseSpotKey, type DetailError, type DetailFlags } from "@/lib/tajweed/spots";
import type { TajweedKind } from "@/lib/tajweed/taxonomy";

type SpotAction = (input: {
  segmentId: string;
  ayah: number;
  wordPosition: number;
  letter: number;
  gapAfter: boolean;
  errors: { kind: TajweedKind; code: string; confusedWith: string | null }[];
}) => Promise<{ error?: string }>;
type MasterAction = (input: { surahNumber: number; ayah: number; wordPosition: number; letter: number; gapAfter: boolean }) => Promise<
  { error: string } | { ok: true }
>;

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
  detail,
  subject,
  hint: hintText,
  liveUndo,
}: {
  segment: HomeSegmentView;
  groupGender: GroupGender;
  actions: SegmentActions;
  listHref: string;
  initialFlags: WordFlags;
  mark: MarkAction;
  afterAyah?: (ayah: number) => ReactNode;
  // detailed tajweed marks (lib/tajweed), when she has them on: her open
  // ones in this passage, and the actions that save a spot and master one
  // master absent: «تم الإتقان» isn't offered («العائلة»: a child's marks are resolved by an adult)
  detail?: { initial: DetailFlags; save: SpotAction; master?: MasterAction };
  // whose marks: herself by default («العائلة»: an adult practising with a child)
  subject?: RecitationSubject;
  // passed on to SegmentPractice (Rafiq and «العائلة»)
  liveUndo?: boolean;
  // replaces the hint above the ayat
  hint?: string;
}) {
  const [flags, setFlags] = useState<WordFlags>(initialFlags);
  const [details, setDetails] = useState<DetailFlags>(detail?.initial ?? {});

  /** One spot's marks changed in the sheet: shown at once, saved, put back if refused. */
  function onDetailChange(key: string, errors: DetailError[]) {
    const p = parseSpotKey(key);
    if (!p || !detail) return;
    const before = details;
    const next = { ...details };
    if (errors.length > 0) next[key] = errors;
    else delete next[key];
    setDetails(next);
    setError(null);
    detail.save({ segmentId: segment.id, ayah: p.ayah, wordPosition: p.wordPosition, ...p.spot, errors }).then((r) => {
      if (r.error) {
        setDetails(before);
        setError(r.error);
      }
    });
  }

  /** «تم الإتقان» for everything on one spot: it leaves the screen (and her list). */
  function onMasterSpot(key: string) {
    const p = parseSpotKey(key);
    if (!p || !detail?.master) return;
    const before = details;
    const next = { ...details };
    delete next[key];
    setDetails(next);
    setError(null);
    detail.master({ surahNumber: p.surah, ayah: p.ayah, wordPosition: p.wordPosition, ...p.spot }).then((r) => {
      if ("error" in r) {
        setDetails(before);
        setError(r.error);
      }
    });
  }
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
  const hint =
    hintText ??
    `🔖 ${p("اضغط", "اضغطي")} على أي كلمة ${p("أخطأتَ", "أخطأتِ")} فيها لتحديدها، ثم ${p("علّمها", "علّميها")} متقَنة حين ${p("تتقنها", "تتقنينها")}. لا يرى هذه الكلمات أحد غيرك.` +
    (detail
      ? ` وللتجويد المفصّل ${p("اختر", "اختاري")} من قائمة الكلمة مخرجًا أو صفة أو حكمًا ثم الحرف نفسه، أو ${p("اضغط", "اضغطي")} على الفاصل بين كلمتين.`
      : "");
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
        marking={{
          flags,
          onFlag,
          subject: subject ?? { self },
          hint,
          ...(detail ? { detail: { flags: details, onChange: onDetailChange, onMasterSpot: detail.master ? onMasterSpot : undefined } } : {}),
        }}
        afterAyah={afterAyah}
        liveUndo={liveUndo}
      />
    </>
  );
}
