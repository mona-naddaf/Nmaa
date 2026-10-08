"use client";

import { useRouter } from "next/navigation";
import styles from "@/components/home-log/home-log.module.css";
import { MistakesList } from "@/components/mistakes/MistakesList";
import type { ActiveMistake } from "@/lib/students/mistake-types";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";
import { resolveHomeWordAction } from "./actions";

// «كلماتي للمراجعة»: the words she marked herself while practising at home.
// Private to her: separate from the official list her teachers keep.
export function SelfMarksList({ mistakes, g }: { mistakes: ActiveMistake[]; g: GroupGender }) {
  const router = useRouter();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  return (
    <>
      <div className={styles.sectionTitle}>🔖 كلماتي للمراجعة</div>
      <div className={styles.section}>
        <p className={styles.muted} style={{ marginTop: 0 }}>
          الكلمات التي {p("حدّدتَها", "حدّدتِها")} بنفسك أثناء التدريب. لا يراها أحد غيرك.
        </p>
        {mistakes.length === 0 ? (
          <div className={styles.empty}>
            لا توجد كلمات بعد — {p("اضغط", "اضغطي")} على أي كلمة في صفحة المقطع لتحديدها.
          </div>
        ) : (
          <MistakesList
            mistakes={mistakes}
            subject={{ self: g === "GIRLS" ? "FEMALE" : "MALE" }}
            onResolve={async (m) => {
              const r = await resolveHomeWordAction(m.surahNumber, m.ayah, m.wordPosition);
              if (!("error" in r)) router.refresh();
              return r;
            }}
          />
        )}
      </div>
    </>
  );
}
