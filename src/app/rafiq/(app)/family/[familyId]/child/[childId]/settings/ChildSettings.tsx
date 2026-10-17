"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import styles from "../../../../../../rafiq.module.css";
import f from "../../../../family.module.css";
import { WeekdayPicker } from "@/components/student-work/TrackerControls";
import { daysLabel } from "@/lib/tracker/rules";
import { localToday } from "@/lib/home-log/rules";
import type { ChildFeature } from "@/lib/family/rules";
import type { ChildFlags } from "@/lib/family/child-pages";
import { setChildFeatureAction } from "../../../../actions";
import { setCommitDaysAction, setReviewRemindersAction } from "../../../../../settings/actions";
import { LeaveGuard, trackSave } from "@/components/leave-guard/LeaveGuard";

const FAIL = "تعذّر حفظ الإعداد، يُرجى المحاولة مرة أخرى";

/**
 * A switch shown at once, saved in the background, and put back with a short
 * message if saving fails (an error answer or none at all). A refreshed page
 * brings the saved value.
 */
function useOptimistic(saved: boolean) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [seen, setSeen] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  if (seen !== saved) {
    setSeen(saved);
    setOn(saved);
  }
  const set = (next: boolean, save: (on: boolean) => Promise<{ error?: string } | null>) => {
    const before = on;
    setOn(next);
    setError(null);
    start(async () => {
      const r = await trackSave(save(next)).catch(() => ({ error: FAIL }));
      if (r?.error) {
        setOn(before);
        setError(FAIL);
        return;
      }
      router.refresh();
    });
  };
  return { on, set, error };
}

type Row = { key: ChildFeature; title: string; what: string; needs?: ChildFeature };

/**
 * «إعدادات {الاسم}» («العائلة»): the child's switches, all off by default.
 * Adults with edit rights change them; view-only adults see them. Turning one
 * off hides it and keeps everything already saved.
 */
export function ChildSettings({
  childId,
  name,
  gender,
  canEdit,
  flags,
  commitDays,
}: {
  childId: string;
  name: string;
  gender: "MALE" | "FEMALE";
  canEdit: boolean;
  flags: ChildFlags;
  commitDays: number;
}) {
  const g = (m: string, fem: string) => (gender === "FEMALE" ? fem : m);
  const rows: Row[] = [
    { key: "homeLog", title: "حفظي في البيت", what: `${g("يسجّل", "تسجّل")} ${name} ما ${g("يحفظه", "تحفظه")} في البيت (سماع، تكرار، تسميع لأحد)، ويمكنكم إضافة المقاطع والتسجيل ${g("معه", "معها")}.` },
    { key: "homeMistakes", title: "تحديد أخطائي في البيت", what: `${g("يحدّد", "تحدّد")} ${name} الكلمات التي ${g("أخطأ", "أخطأت")} فيها أثناء التدريب في البيت، فتظهر في ${g("كلماته", "كلماتها")} التي تحتاج مراجعة.`, needs: "homeLog" },
    { key: "goal", title: "هدف الحفظ", what: `تضعون ${g("له", "لها")} هدفًا من صفحة الخطة، ${g("ويراه", "وتراه")} في ${g("صفحته", "صفحتها")} و${g("خطته", "خطتها")}.` },
    { key: "mutashabihat", title: "المتشابهات", what: "علامة «≈» بعد الآيات التي لها آيات متشابهة، مع عرض تلك الآيات." },
    { key: "tajweed", title: "أخطاء التجويد المفصّلة", what: `تحديد خطأ التجويد على الحرف أو بين كلمتين عند التسميع ${g("معه", "معها")}، مع ملخّص في ${g("صفحته", "صفحتها")}.` },
    { key: "agenda", title: "الجدول اليومي", what: "أوقات لبنود جدول المتابعة وجدول اليوم؛ الأوقات المرتبطة بالصلاة من مكان العائلة." },
    { key: "summary", title: "المحصّلات", what: "ملخّص أسبوعي وشهري وأكثر لجدول المتابعة." },
    { key: "streak", title: "أيام الالتزام والسلسلة", what: `🔥 أيام الالتزام المتتالية في ${g("صفحته", "صفحتها")}، حسب الأيام التي تختارونها هنا.` },
  ];
  return (
    <div className={styles.settingsGrid}>
      <div className={hl.sectionTitle} style={{ margin: "0 4px" }}>
        <span style={{ fontSize: 16, color: "var(--ink)" }}>إعدادات {name}</span>
      </div>
      <p className={hl.muted} style={{ margin: "0 4px" }}>
        {canEdit
          ? `كل الإعدادات متوقفة في البداية. إيقاف أي منها لاحقًا يخفيه فقط، ويبقى ما سُجّل فيه محفوظًا.`
          : "مشاهدة فقط — يمنح مؤسِّس العائلة صلاحية التعديل."}
      </p>
      <div className={hl.section}>
        <div className={f.list}>
          {rows.map((r) => (
            <Switch key={r.key} row={r} childId={childId} saved={flags[r.key]} canEdit={canEdit} blockedBy={r.needs && !flags[r.needs] ? rows.find((x) => x.key === r.needs)?.title : undefined} />
          ))}
          <Reminders childId={childId} name={name} g={g} days={flags.reviewReminderDays} canEdit={canEdit} />
        </div>
      </div>
      {flags.streak && <CommitDays childId={childId} name={name} g={g} initial={commitDays} canEdit={canEdit} />}
      <LeaveGuard />
    </div>
  );
}

function Switch({ row, childId, saved, canEdit, blockedBy }: { row: Row; childId: string; saved: boolean; canEdit: boolean; blockedBy?: string }) {
  const t = useOptimistic(saved);
  return (
    <div className={f.row}>
      <label className={f.check} style={{ fontWeight: 700 }}>
        <input
          type="checkbox"
          checked={t.on}
          disabled={!canEdit || (!!blockedBy && !t.on)}
          onChange={(e) => t.set(e.target.checked, (on) => setChildFeatureAction(childId, row.key, on))}
        />
        {row.title}
      </label>
      <div className={hl.muted}>{row.what}</div>
      {blockedBy && !t.on && <div className={hl.muted}>يحتاج تفعيل «{blockedBy}» أولًا.</div>}
      {t.error && <div className={hl.err}>{t.error}</div>}
    </div>
  );
}

/** «تذكير المراجعة»: off, or the days (1–90) a completed surah may go unreviewed; 7 when first turned on. */
function Reminders({ childId, name, g, days, canEdit }: { childId: string; name: string; g: (m: string, f: string) => string; days: number | null; canEdit: boolean }) {
  const router = useRouter();
  const save = (on: boolean, n: number) => {
    const fd = new FormData();
    fd.set("on", on ? "1" : "0");
    fd.set("days", String(n));
    fd.set("subjectId", childId);
    return setReviewRemindersAction(null, fd);
  };
  const t = useOptimistic(days !== null);
  const [value, setValue] = useState(String(days ?? 7));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className={f.row} id="reminders">
      <label className={f.check} style={{ fontWeight: 700 }}>
        <input type="checkbox" checked={t.on} disabled={!canEdit} onChange={(e) => t.set(e.target.checked, (on) => save(on, Number(value) || 7))} />
        تذكير المراجعة
      </label>
      <div className={hl.muted}>
        تنبيه في {g("صفحته", "صفحتها")} بكل سورة {g("أتمّ", "أتمّت")} {name} حفظها ولم {g("يراجعها", "تراجعها")} كاملةً منذ المدة المحدّدة.
      </div>
      {t.on && (
        <div className={hl.actionsRow} style={{ alignItems: "center" }}>
          <label htmlFor="reminder-days" className={hl.muted}>
            عدد الأيام
          </label>
          <input
            id="reminder-days"
            type="number"
            min={1}
            max={90}
            className={styles.input}
            style={{ width: 90 }}
            value={value}
            disabled={!canEdit}
            onChange={(e) => {
              setValue(e.target.value);
              setOk(false);
            }}
          />
          {canEdit && (
            <button
              type="button"
              className={hl.ghostBtn}
              disabled={pending || Number(value) === days}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await trackSave(save(true, Number(value))).catch(() => ({ error: FAIL }));
                  if (r?.error) return setError(r.error);
                  setOk(true);
                  router.refresh();
                })
              }
            >
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          )}
          {ok && <span className={styles.okMsg} style={{ margin: 0 }}>تم الحفظ ✓</span>}
        </div>
      )}
      {(t.error || error) && <div className={hl.err}>{t.error ?? error}</div>}
    </div>
  );
}

/** The weekdays the child commits to (with the streak on), from today on. */
function CommitDays({ childId, name, g, initial, canEdit }: { childId: string; name: string; g: (m: string, f: string) => string; initial: number; canEdit: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={hl.section} id="commit">
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        أيام الالتزام
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        الأيام التي {g("يسجّل", "تسجّل")} فيها {name} جلسة. لا تقطع أيامُ الراحة السلسلةَ، ويسري التغيير من اليوم.
      </p>
      {canEdit ? <WeekdayPicker days={days} onChange={setDays} /> : null}
      <div className={hl.muted} style={{ margin: "6px 0 10px" }}>
        الحالي: {daysLabel(saved)}
      </div>
      {error && <div className={hl.err} style={{ marginBottom: 10 }}>{error}</div>}
      {canEdit && (
        <button
          type="button"
          className={hl.primaryBtn}
          disabled={pending || days === saved}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await trackSave(setCommitDaysAction({ days, today: localToday(), subjectId: childId })).catch(() => ({ error: FAIL }));
              if (r?.error) return setError(r.error);
              setSaved(days);
              router.refresh();
            })
          }
        >
          {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      )}
    </div>
  );
}
