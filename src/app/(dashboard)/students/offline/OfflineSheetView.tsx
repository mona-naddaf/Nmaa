"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import styles from "../import/import.module.css";
import o from "./offline.module.css";
import { SURAH_NAME } from "@/lib/quran-data";
import { imperative, absentWord, presentWord, type PersonGender } from "@/lib/text/gender";
import { confirmOfflineSheetAction, previewOfflineSheetAction, type ConfirmResult, type PreviewResult } from "./actions";
import type { PreviewEntry, PreviewRow } from "@/lib/offline-sheet/validate";
import { countLabel, REASONS, ROWS, SESSIONS } from "@/lib/text/count";

const TYPE_LABEL = { NEW: "حفظ جديد", REVIEW: "مراجعة", LINK: "ربط" } as const;
const QUALITY_LABEL = { EXCELLENT: "متقن (بدون أخطاء)", GOOD: "جيد", NEEDS_REPEAT: "يحتاج إعادة" } as const;

export function OfflineSheetView({
  groups,
  viewerGender,
  maxDaysBack,
}: {
  groups: { id: string; name: string }[];
  viewerGender: PersonGender;
  maxDaysBack: number;
}) {
  const you = (forms: { m: string; f: string }) => imperative(viewerGender, forms);
  const [group, setGroup] = useState("all");
  // the file the preview was made from: the save sends the same file (the
  // form clears its input once its action has run)
  const [file, setFile] = useState<File | null>(null);
  const [preview, previewAction, previewPending] = useActionState<PreviewResult | null, FormData>(previewOfflineSheetAction, null);
  // the confirm step's answer replaces the preview (a fresh preview, or the result)
  const [confirmed, setConfirmed] = useState<{ for: PreviewResult | null; result: ConfirmResult } | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savePending, startSave] = useTransition();

  const current: ConfirmResult | null = confirmed && confirmed.for === preview ? confirmed.result : preview;

  function save() {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    data.set("reasons", JSON.stringify(reasons));
    startSave(async () => {
      const result = await confirmOfflineSheetAction(data);
      setConfirmed({ for: preview, result });
    });
  }

  return (
    <div>
      <Link href="/students" className={styles.back}>
        → رجوع للقائمة
      </Link>

      <div className={styles.secTitle} id="download">
        <span className={styles.dot} /> ١. تنزيل الملف
      </div>
      <div className={styles.card}>
        <p className={styles.hint}>
          ملف Excel لتسجيل حضور يوم واحد وتسميعه ونقاطه دون اتصال بالإنترنت: ورقة لكل مجموعة، فيها الطلاب الحاليون، وفي
          الحفظ الجديد لكلٍّ منهم الموضع التالي معبَّأً مسبقًا. {you({ m: "اكتب", f: "اكتبي" })} في أعلى الورقة الأولى تاريخ اليوم
          الذي تُسجَّل بياناته (حتى {maxDaysBack} يومًا مضت)، ثم {you({ m: "ارفعه", f: "ارفعيه" })} هنا عند توفّر الاتصال.
        </p>
        {groups.length === 0 ? (
          <p className={styles.hint}>لا توجد مجموعات متاحة بعد.</p>
        ) : (
          <div className={o.groupPick}>
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="المجموعة">
              <option value="all">كل المجموعات المتاحة</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <a className={styles.downloadBtn} href={`/api/students/offline-sheet?group=${encodeURIComponent(group)}`} download>
              ⬇ تنزيل الملف
            </a>
          </div>
        )}
      </div>

      <div className={styles.secTitle} id="upload">
        <span className={styles.dot} /> ٢. رفع الملف بعد تعبئته
      </div>
      <form
        className={styles.card}
        action={(data) => {
          const picked = data.get("file");
          setFile(picked instanceof File ? picked : null);
          setReasons({});
          setConfirmed(null);
          previewAction(data);
        }}
      >
        <input className={styles.file} type="file" name="file" accept=".xlsx" required />
        <button className={styles.saveBtn} type="submit" disabled={previewPending || savePending}>
          {previewPending ? "جارٍ قراءة الملف..." : "معاينة قبل الحفظ"}
        </button>
        <p className={styles.note}>لا يُحفظ شيء قبل مراجعة المعاينة والضغط على «حفظ».</p>
      </form>

      {current && "error" in current && <div className={styles.err}>{current.error}</div>}

      {current && "saved" in current && (
        <div className={styles.card}>
          <div className={styles.summary}>
            <div className={`${styles.stat} ${styles.ok}`}>
              <div className={styles.num}>{current.saved.students}</div>
              <div className={styles.lbl}>حُفظت بياناتهم</div>
            </div>
            <div className={`${styles.stat} ${styles.ok}`}>
              <div className={styles.num}>{current.saved.sessions}</div>
              <div className={styles.lbl}>تسميع</div>
            </div>
            <div className={`${styles.stat} ${styles.ok}`}>
              <div className={styles.num}>{current.saved.points}</div>
              <div className={styles.lbl}>نقطة</div>
            </div>
          </div>
          <p className={styles.hint}>
            حُفظت بيانات يوم <bdi dir="ltr">{current.date}</bdi>. الحضور المسجَّل: {current.saved.attendance}
            {current.saved.attendanceChanged > 0 && ` (منه ${current.saved.attendanceChanged} غيّر ما كان مسجَّلًا على الموقع)`}
            {current.saved.duplicates > 0 && `، وتُخطّيت ${countLabel(current.saved.duplicates, SESSIONS)} مسجَّلة من قبل`}
            {current.saved.notSaved > 0 && `، ولم يُحفظ ما في ${countLabel(current.saved.notSaved, ROWS)} فيها أخطاء`}.
          </p>
          <Link href="/students" className={styles.back}>
            عرض القائمة ←
          </Link>
        </div>
      )}

      {current && "rows" in current && (
        <Preview
          result={current}
          reasons={reasons}
          setReasons={setReasons}
          onSave={save}
          pending={savePending}
          you={you}
        />
      )}
    </div>
  );
}

function Preview({
  result,
  reasons,
  setReasons,
  onSave,
  pending,
  you,
}: {
  result: Extract<PreviewResult, { rows: PreviewRow[] }>;
  reasons: Record<string, string>;
  setReasons: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  onSave: () => void;
  pending: boolean;
  you: (forms: { m: string; f: string }) => string;
}) {
  const good = result.rows.filter((r) => r.errors.length === 0 && r.studentId && (r.attendance || r.entries.length || r.points));
  const bad = result.rows.filter((r) => r.errors.length > 0);
  const skipped = result.rows.filter((r) => r.errors.length === 0 && !(r.attendance || r.entries.length || r.points));
  const newSessions = good.flatMap((r) => r.entries).filter((e) => !e.duplicate);
  const needReason = newSessions.filter((e) => e.requiresReason);
  const missing = needReason.filter((e) => !reasons[e.key]?.trim()).length;
  const changes = good.filter((r) => r.attendance?.previous && r.attendance.previous !== r.attendance.value).length;

  return (
    <div className={styles.card}>
      <div className={styles.summary}>
        <div className={`${styles.stat} ${styles.ok}`}>
          <div className={styles.num}>{good.length}</div>
          <div className={styles.lbl}>ستُحفظ بياناتهم</div>
        </div>
        <div className={`${styles.stat} ${styles.ok}`}>
          <div className={styles.num}>{newSessions.length}</div>
          <div className={styles.lbl}>تسميع جديد</div>
        </div>
        <div className={`${styles.stat} ${bad.length > 0 ? styles.bad : ""}`}>
          <div className={styles.num}>{bad.length}</div>
          <div className={styles.lbl}>أسطر فيها أخطاء</div>
        </div>
      </div>

      <p className={o.previewHead}>
        تاريخ الملف: <bdi dir="ltr">{result.date}</bdi>. تُحفظ البيانات بهذا التاريخ كما لو سُجِّلت على الموقع يومها.
        {changes > 0 && (
          <span className={o.change}> يغيّر الملف حضورًا سبق تسجيله على الموقع لهذا اليوم (العدد: {changes}، موضَّح أدناه).</span>
        )}
        {result.emptyRows > 0 && ` عدد الأسطر التي لا بيانات فيها لهذا اليوم: ${result.emptyRows}، ولن يُحفظ لها شيء.`}
      </p>

      {"notice" in result && result.notice && <div className={o.notice}>{result.notice}</div>}
      {needReason.length > 0 && (
        <div className={o.notice}>
          عدد التسجيلات التي تحتاج إلى سبب (فجوة في الخطة أو إعادة تسجيل): {needReason.length}، كما في نموذج التسميع على
          الموقع. {you({ m: "اكتب", f: "اكتبي" })} السبب في موضعه أدناه.
        </div>
      )}

      {good.length > 0 && (
        <>
          <div className={o.subTitle}>ما سيُحفظ</div>
          {good.map((r) => (
            <StudentPreview key={r.studentId} row={r} reasons={reasons} setReasons={setReasons} />
          ))}
        </>
      )}

      {bad.length > 0 && (
        <>
          <div className={o.subTitle}>لن تُحفظ (فيها أخطاء — {you({ m: "صحّحها", f: "صحّحيها" })} في الملف ثم {you({ m: "ارفعه", f: "ارفعيه" })} من جديد)</div>
          {bad.map((r) => (
            <div className={o.studentRow} key={`${r.sheet}:${r.row}`}>
              <div className={o.studentHead}>
                <span className={o.studentName}>{r.name}</span>
                <span className={o.studentMeta}>
                  {r.groupName} · «{r.sheet}» السطر {r.row}
                </span>
              </div>
              {r.errors.map((e, i) => (
                <div className={o.rowError} key={i}>
                  • {e}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {skipped.length > 0 && (
        <>
          <div className={o.subTitle}>تُتخطّى</div>
          {skipped.map((r) => (
            <div className={o.studentRow} key={`${r.sheet}:${r.row}`}>
              <span className={o.studentName}>{r.name}</span>
              {r.warnings.map((w, i) => (
                <div className={o.warning} key={i}>
                  {w}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      <div className={o.actions}>
        <button className={styles.saveBtn} type="button" onClick={onSave} disabled={pending || good.length === 0 || missing > 0}>
          {pending ? "جارٍ الحفظ..." : missing > 0 ? `حفظ (ينقص ${countLabel(missing, REASONS)})` : "حفظ"}
        </button>
      </div>
    </div>
  );
}

function StudentPreview({
  row: r,
  reasons,
  setReasons,
}: {
  row: PreviewRow;
  reasons: Record<string, string>;
  setReasons: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const g = r.groupGender;
  const word = (v: "IN" | "OUT") => (v === "IN" ? presentWord(g) : absentWord(g));
  return (
    <div className={o.studentRow}>
      <div className={o.studentHead}>
        <span className={o.studentName}>{r.name}</span>
        <span className={o.studentMeta}>{r.groupName}</span>
      </div>
      {r.attendance && (
        <div className={o.line}>
          الحضور: {word(r.attendance.value)}
          {r.attendance.previous && r.attendance.previous !== r.attendance.value && (
            <span className={o.change}> (مسجَّل على الموقع: {word(r.attendance.previous)} ← سيصبح {word(r.attendance.value)})</span>
          )}
          {r.attendance.previous === r.attendance.value && <span className={`${o.badge} ${o.badgeSkip}`}>مسجَّل مسبقًا</span>}
        </div>
      )}
      {r.entries.map((e) => (
        <Entry key={e.key} e={e} reason={reasons[e.key] ?? ""} onReason={(v) => setReasons((prev) => ({ ...prev, [e.key]: v }))} />
      ))}
      {r.points && r.points.requested > 0 && (
        <div className={o.line}>
          النقاط: {r.points.requested}
          {r.points.alreadySaved > 0 &&
            (r.points.toAdd > 0 ? (
              <span className={`${o.badge} ${o.badgeSkip}`}>
                {r.points.alreadySaved} منها محفوظة من ملف سابق لهذا اليوم، تُضاف {r.points.toAdd}
              </span>
            ) : (
              <span className={`${o.badge} ${o.badgeSkip}`}>محفوظة من قبل — تُتخطّى</span>
            ))}
        </div>
      )}
      {r.warnings.map((w, i) => (
        <div className={o.warning} key={i}>
          {w}
        </div>
      ))}
    </div>
  );
}

function Entry({ e, reason, onReason }: { e: PreviewEntry; reason: string; onReason: (v: string) => void }) {
  return (
    <div>
      <div className={o.line}>
        {TYPE_LABEL[e.type]}: سورة {SURAH_NAME[e.surahNumber]} — آية {e.fromAyah} إلى {e.toAyah} · {QUALITY_LABEL[e.quality]} ·{" "}
        {e.pages} صفحة
        {e.duplicate ? (
          <span className={`${o.badge} ${o.badgeSkip}`}>مسجَّل مسبقًا لهذا اليوم — يُتخطّى</span>
        ) : (
          e.badgeText && <span className={`${o.badge} ${e.requiresReason ? o.badgeWarn : ""}`}>{e.badgeText}</span>
        )}
      </div>
      {!e.duplicate && e.warning && <div className={o.warning}>{e.warning}</div>}
      {!e.duplicate && e.requiresReason && (
        <textarea
          className={o.reason}
          rows={2}
          maxLength={500}
          placeholder="سبب هذا التسجيل (إلزامي)..."
          value={reason}
          onChange={(ev) => onReason(ev.target.value)}
          aria-label={`سبب تسجيل سورة ${SURAH_NAME[e.surahNumber]}`}
        />
      )}
    </div>
  );
}
