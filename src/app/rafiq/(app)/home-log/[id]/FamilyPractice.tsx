"use client";

import { PracticeWithMarks } from "@/components/home-log/PracticeWithMarks";
import { SegmentPractice, type SegmentActions } from "@/components/home-log/SegmentPractice";
import type { WordFlags } from "@/components/mistakes/FlaggableAyah";
import type { HomeSegmentView } from "@/lib/home-log/data";
import type { DetailFlags } from "@/lib/tajweed/spots";
import type { GroupGender } from "@/lib/text/gender";
import { deleteSegmentAction, finishSegmentAction, markSpotAction, markWordAction, resolveSpotAction, tapAction, undoTapAction } from "../actions";

// «العائلة»: one of a child's home passages — for the child herself
// (subjectId absent: her own session), or for an adult with edit rights
// practising with her (subjectId: the child). Marks: the child's own only
// with her «تحديد أخطائي في البيت» switch; an adult always may mark, and only
// an adult resolves («تم الإتقان»).
export function FamilyPractice({
  segment,
  g,
  listHref,
  viewer,
  subjectId,
  childName,
  you = null,
  marks,
  initialFlags,
  detailInitial = null,
}: {
  segment: HomeSegmentView;
  // the child's
  g: GroupGender;
  listHref: string;
  viewer: "child" | "adult-edit";
  subjectId?: string;
  childName: string;
  // the adult looking (an adult's view)
  you?: "MALE" | "FEMALE" | null;
  marks: boolean;
  initialFlags: WordFlags;
  // detailed tajweed marks (the child's switch on): her open ones here
  detailInitial?: DetailFlags | null;
}) {
  const actions: SegmentActions = {
    tap: (input) => tapAction({ ...input, subjectId }),
    undoTap: (input) => undoTapAction({ ...input, subjectId }),
    finish: (id) => finishSegmentAction(id, subjectId),
    remove: (id) => deleteSegmentAction(id, subjectId),
  };
  if (!marks) return <SegmentPractice segment={segment} groupGender={g} actions={actions} listHref={listHref} />;

  const c = (m: string, f: string) => (g === "GIRLS" ? f : m);
  const y = (m: string, f: string) => (you === "FEMALE" ? f : m);
  const adult = viewer === "adult-edit";
  return (
    <PracticeWithMarks
      segment={segment}
      groupGender={g}
      actions={actions}
      listHref={listHref}
      initialFlags={initialFlags}
      mark={(input) => markWordAction(input, subjectId)}
      subject={adult ? { child: { name: childName, gender: g === "GIRLS" ? "FEMALE" : "MALE" } } : undefined}
      hint={
        adult
          ? `🔖 ${y("اضغط", "اضغطي")} على أي كلمة ${c("أخطأ", "أخطأت")} فيها ${childName} لتحديدها؛ تظهر في ${c("كلماته", "كلماتها")} التي تحتاج مراجعة.`
          : `🔖 ${c("اضغط", "اضغطي")} على أي كلمة ${c("أخطأتَ", "أخطأتِ")} فيها لتحديدها. يرى أهلك هذه الكلمات أيضًا.`
      }
      detail={
        detailInitial
          ? {
              initial: detailInitial,
              save: (input) => markSpotAction({ ...input, subjectId }),
              master: adult ? (input) => resolveSpotAction({ ...input, subjectId }) : undefined,
            }
          : undefined
      }
    />
  );
}
