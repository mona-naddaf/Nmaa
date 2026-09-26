"use client";

import { useActionState } from "react";
import Link from "next/link";
import styles from "./import.module.css";
import { importStudentsAction, type ImportState } from "./actions";
import { imperative, type PersonGender } from "@/lib/text/gender";

export function ImportForm({ viewerGender, hasGroups }: { viewerGender: PersonGender; hasGroups: boolean }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importStudentsAction, null);
  const you = (forms: { m: string; f: string }) => imperative(viewerGender, forms);

  return (
    <div>
      <Link href="/students" className={styles.back}>
        → رجوع للقائمة
      </Link>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> ١. تحميل القالب
      </div>
      <div className={styles.card}>
        {hasGroups ? (
          <>
            <p className={styles.hint}>
              {you({ m: "اختر", f: "اختاري" })} صيغة القالب. قائمة المجموعات داخل الملف تُؤخذ من مجموعات الدورة الحالية، فلو
              تغيّرت المجموعات {you({ m: "حمّل", f: "حمّلي" })} القالب من جديد.
            </p>
            <div className={styles.downloads}>
              <a className={styles.downloadBtn} href="/api/students/import-template?variant=girls" download>
                ⬇ قالب الطالبات
              </a>
              <a className={styles.downloadBtn} href="/api/students/import-template?variant=boys" download>
                ⬇ قالب الطلاب
              </a>
            </div>
          </>
        ) : (
          <p className={styles.hint}>
            لا توجد مجموعات في الدورة بعد — {you({ m: "أضف", f: "أضيفي" })} المجموعات من{" "}
            <Link href="/settings">الإعدادات</Link> أولًا.
          </p>
        )}
      </div>

      <div className={styles.secTitle}>
        <span className={styles.dot} /> ٢. رفع الملف بعد تعبئته
      </div>
      <form className={styles.card} action={formAction}>
        <input className={styles.file} type="file" name="file" accept=".xlsx" required />
        <button className={styles.saveBtn} type="submit" disabled={pending}>
          {pending ? "جارٍ الاستيراد..." : "استيراد"}
        </button>
        <p className={styles.note}>
          تُستورد الأسطر الصحيحة فقط؛ الأسطر التي فيها خطأ أو اسم مكرَّر تُتجاهل ويظهر سببها بالأسفل.
        </p>
      </form>

      {state && "error" in state && <div className={styles.err}>{state.error}</div>}

      {state && "created" in state && (
        <div className={styles.card}>
          <div className={styles.summary}>
            <div className={`${styles.stat} ${styles.ok}`}>
              <div className={styles.num}>{state.created}</div>
              <div className={styles.lbl}>تمت إضافتهم</div>
            </div>
            <div className={`${styles.stat} ${state.skipped.length > 0 ? styles.bad : ""}`}>
              <div className={styles.num}>{state.skipped.length}</div>
              <div className={styles.lbl}>تم تجاهلهم</div>
            </div>
          </div>

          {state.exampleSkipped && <p className={styles.hint}>سطر المثال (السطر 5) لم يُعدَّل، فتم تجاهله.</p>}

          {state.skipped.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>السطر</th>
                    <th>الاسم</th>
                    <th>السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {state.skipped.map((s) => (
                    <tr key={s.row}>
                      <td>{s.row}</td>
                      <td>{s.name || "—"}</td>
                      <td>{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {state.created > 0 && (
            <Link href="/students" className={styles.back}>
              عرض القائمة ←
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
