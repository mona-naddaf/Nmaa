"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import hl from "@/components/home-log/home-log.module.css";
import styles from "../../../rafiq.module.css";
import f from "../family.module.css";
import { dayOfInstant, useToday } from "@/lib/calendar/useToday";
import { DELETE_CONFIRM_WORD } from "@/lib/rafiq/rules";
import { FAMILY_LIMITS, INVITE_DAYS } from "@/lib/family/rules";
import type { ChildView, FamilyView as View, InviteView, MemberView } from "@/lib/family/data";
import { ACCOUNT_LIMITS } from "@/lib/rafiq/rules";
import { CityPicker } from "@/components/prayer/CityPicker";
import { LeaveGuard, trackSave } from "@/components/leave-guard/LeaveGuard";
import { FamilyDashboard } from "@/components/family/FamilyDashboard";
import type { DashboardData } from "@/lib/family/dashboard-build";
import type { FamilyCalendarData } from "@/lib/family/calendar";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import {
  createChildAction,
  createInviteAction,
  deleteChildAction,
  deleteFamilyAction,
  newChildCodeAction,
  setFamilyPlaceAction,
  setMySharingAction,
  setSiblingsVisibleAction,
  stopChildLoginAction,
  leaveFamilyAction,
  removeMemberAction,
  renameFamilyAction,
  revokeInviteAction,
  setEditRightsAction,
  transferFounderAction,
  type FamilyState,
} from "../actions";

type P = (m: string, f: string) => string;
// wording about another member follows that member's gender
const by = (g: PersonGender, m: string, fem: string) => pickByPerson(g, { m, f: fem });

/** Runs one family action, then shows its error (if any) and refreshes the page. */
function useFamilyAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<FamilyState>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        after?.();
        router.refresh();
      }
    });
  return { pending, error, run };
}

export function FamilyView({ view, gender, dashboard, upcoming }: { view: View; gender: PersonGender; dashboard: DashboardData | null; upcoming: FamilyCalendarData }) {
  const p: P = (m, fem) => pickByPerson(gender, { m, f: fem });
  const me = view.members.find((m) => m.isMe);
  return (
    <div className={styles.settingsGrid}>
      <div className={f.head}>
        <span className={f.title}>{view.name}</span>
        <Link href="/rafiq/family?list=1" className={f.back}>
          عائلاتي ←
        </Link>
      </div>
      <p className={hl.muted} style={{ margin: "0 4px" }}>
        {view.isFounder
          ? `${p("أنت", "أنتِ")} ${p("مؤسِّس", "مؤسِّسة")} هذه العائلة.`
          : view.canEditChildren
            ? `${p("تستطيع", "تستطيعين")} مشاهدة بيانات الأطفال وتعديلها.`
            : `${p("تستطيع", "تستطيعين")} مشاهدة بيانات الأطفال، ويمنح المؤسِّس صلاحية التعديل.`}
      </p>

      <div style={{ margin: "0 0 12px" }}>
        <Link href={`/rafiq/family/${view.id}/calendar`} className={hl.linkBtn}>
          📅 تقويم العائلة ←
        </Link>
      </div>

      {dashboard && <FamilyDashboard data={dashboard} viewer="adult" upcoming={upcoming} calendarHref={`/rafiq/family/${view.id}/calendar`} />}

      <Sharing view={view} p={p} />

      <Adults view={view} p={p} />

      <Children view={view} p={p} />
      {view.canEditChildren && view.children.length > 0 && (
        <div className={hl.section}>
          <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
            المدينة (لمواقيت الصلاة)
          </div>
          <CityPicker
            initial={view.place}
            previewZone={null}
            intro="مدينة واحدة لأطفال العائلة: تتيح في «الجدول اليومي» أوقاتًا بالنسبة إلى الصلاة (مثل «بعد الفجر»). لكلّ بالغ مدينته في إعداداته."
            onSave={(loc) => setFamilyPlaceAction(view.id, loc).then((r) => r ?? {})}
          />
        </div>
      )}

      {view.isFounder && <Invites view={view} p={p} />}
      {view.isFounder && <Rename view={view} />}
      {!view.isFounder && me && <Leave view={view} p={p} />}
      {view.isFounder && <DeleteFamily view={view} p={p} />}
      <LeaveGuard />
    </div>
  );
}

// ---------- sharing (step 5) ----------

/** «مشاركتي مع العائلة»: what of her own Rafiq page this family sees; and, for the founder, the siblings switch. */
function Sharing({ view, p }: { view: View; p: P }) {
  const progress = useOptimisticToggle(view.myShare.progress, "تعذّر حفظ المشاركة، يُرجى المحاولة مرة أخرى");
  const tracker = useOptimisticToggle(view.myShare.tracker, "تعذّر حفظ المشاركة، يُرجى المحاولة مرة أخرى");
  const siblings = useOptimisticToggle(view.siblingsVisible, "تعذّر حفظ الإعداد، يُرجى المحاولة مرة أخرى");
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        مشاركتي مع العائلة
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        ما {p("تشاركه", "تشاركينه")} هنا يراه كل أفراد «{view.name}»، الكبار والأطفال. لا تُشارَك ملاحظاتك ولا أخطاؤك ولا حفظك في البيت ولا إعداداتك أبدًا.
      </p>
      <div className={f.list}>
        <div className={f.row}>
          <label className={f.check} style={{ fontWeight: 700 }}>
            <input type="checkbox" checked={progress.on} onChange={(e) => progress.set(e.target.checked, (on) => setMySharingAction(view.id, "progress", on))} />
            مشاركة تقدّمي
          </label>
          <div className={hl.muted}>موضعك، وصفحاتك المحفوظة، وهل {p("سجّلتَ", "سجّلتِ")} اليوم وآخر جلسة، وهدفك وأيام التزامك.</div>
          {progress.error && <div className={hl.err}>{progress.error}</div>}
        </div>
        <div className={f.row}>
          <label className={f.check} style={{ fontWeight: 700 }}>
            <input type="checkbox" checked={tracker.on} onChange={(e) => tracker.set(e.target.checked, (on) => setMySharingAction(view.id, "tracker", on))} />
            مشاركة جدولي
          </label>
          <div className={hl.muted}>نسبة إنجاز جدول المتابعة اليوم وآخر سبعة أيام فقط، دون أسماء البنود.</div>
          {tracker.error && <div className={hl.err}>{tracker.error}</div>}
        </div>
        {view.isFounder && (
          <div className={f.row}>
            <label className={f.check} style={{ fontWeight: 700 }}>
              <input type="checkbox" checked={siblings.on} onChange={(e) => siblings.set(e.target.checked, (on) => setSiblingsVisibleAction(view.id, on))} />
              يرى الأطفال تقدّم إخوتهم
            </label>
            <div className={hl.muted}>يرى كل طفل موضع إخوته، وهل سجّلوا اليوم، ونسبة جدولهم اليوم فقط.</div>
            {siblings.error && <div className={hl.err}>{siblings.error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- adults ----------

function Adults({ view, p }: { view: View; p: P }) {
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 10px" }}>
        البالغون ({view.members.length} من {FAMILY_LIMITS.adultsPerFamily})
      </div>
      <div className={f.list}>
        {view.members.map((m) => (
          <MemberRow key={m.userId} familyId={view.id} m={m} founderView={view.isFounder} p={p} />
        ))}
      </div>
    </div>
  );
}

function MemberRow({ familyId, m, founderView, p }: { familyId: string; m: MemberView; founderView: boolean; p: P }) {
  const { pending, error, run } = useFamilyAction();
  const [confirm, setConfirm] = useState<"remove" | "transfer" | null>(null);
  const g = m.gender;
  // edit rights switch at once (label and box), and go back if saving fails
  const rights = useOptimisticToggle(m.canEditChildren, "تعذّر حفظ الصلاحية، يُرجى المحاولة مرة أخرى");
  return (
    <div className={f.row}>
      <div className={f.rowHead}>
        <span className={f.name}>
          {m.name}
          {m.isMe && " (أنا)"}
        </span>
        <span className={m.isFounder ? f.tagStrong : f.tag}>{m.isFounder ? by(g, "المؤسِّس", "المؤسِّسة") : by(g, "بالغ", "بالغة")}</span>
        {!m.isFounder && <span className={f.tag}>{rights.on ? by(g, "يستطيع تعديل بيانات الأطفال", "تستطيع تعديل بيانات الأطفال") : "مشاهدة فقط"}</span>}
        {m.email && <span className={f.email}>{m.email}</span>}
      </div>

      {founderView && !m.isFounder && (
        <div className={f.rowActions}>
          <label className={f.check}>
            <input
              type="checkbox"
              checked={rights.on}
              disabled={pending}
              onChange={(e) => rights.set(e.target.checked, (on) => setEditRightsAction(familyId, m.userId, on))}
            />
            صلاحية تعديل بيانات الأطفال
          </label>
          <button type="button" className={hl.linkBtn} onClick={() => setConfirm("transfer")} disabled={pending}>
            نقل دور المؤسِّس
          </button>
          <button type="button" className={styles.linkDanger} onClick={() => setConfirm("remove")} disabled={pending}>
            إزالة من العائلة
          </button>
        </div>
      )}

      {confirm === "transfer" && (
        <div className={f.confirm}>
          <span>
            {by(g, "سيصبح", "ستصبح")} {m.name} {by(g, "مؤسِّسًا", "مؤسِّسةً")} للعائلة، {p("وتبقى", "وتبقين")} فيها {p("بالغًا", "بالغةً")} مع صلاحية تعديل
            بيانات الأطفال (ويمكن {by(g, "للمؤسِّس", "للمؤسِّسة")} الجديد{by(g, "", "ة")} تغييرها).
          </span>
          <div className={hl.actionsRow}>
            <button type="button" className={hl.primaryBtn} disabled={pending} onClick={() => run(() => transferFounderAction(familyId, m.userId), () => setConfirm(null))}>
              {pending ? "جارٍ النقل…" : "نعم، نقل دور المؤسِّس"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setConfirm(null)}>
              تراجع
            </button>
          </div>
        </div>
      )}
      {confirm === "remove" && (
        <div className={f.confirm}>
          <span>
            إزالة {m.name} من العائلة؟ {by(g, "سيفقد", "ستفقد")} الوصول إلى بيانات الأطفال، {by(g, "ويمكنه", "ويمكنها")} الانضمام مجددًا برمز دعوة جديد.
          </span>
          <div className={hl.actionsRow}>
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => removeMemberAction(familyId, m.userId), () => setConfirm(null))}>
              {pending ? "جارٍ الإزالة…" : "نعم، إزالة"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setConfirm(null)}>
              تراجع
            </button>
          </div>
        </div>
      )}
      {(error || rights.error) && <div className={hl.err}>{error ?? rights.error}</div>}
    </div>
  );
}

/**
 * A switch shown at once, saved in the background, and put back with a short
 * message if saving fails. A refreshed page brings the saved value.
 */
function useOptimisticToggle(saved: boolean, failMessage: string) {
  const router = useRouter();
  const [on, setOn] = useState(saved);
  const [seen, setSeen] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  if (seen !== saved) {
    setSeen(saved);
    setOn(saved);
  }
  const set = (next: boolean, save: (on: boolean) => Promise<FamilyState>) => {
    const before = on;
    setOn(next);
    setError(null);
    start(async () => {
      // an error answer, or no answer at all (a dropped connection, an ended session)
      const r = await trackSave(save(next)).catch(() => ({ error: failMessage }));
      if (r?.error) {
        setOn(before);
        setError(failMessage);
        return;
      }
      router.refresh();
    });
  };
  return { on, set, error };
}

// ---------- children ----------

function Children({ view, p }: { view: View; p: P }) {
  const full = view.children.length >= FAMILY_LIMITS.childrenPerFamily;
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 10px" }}>
        الأطفال ({view.children.length} من {FAMILY_LIMITS.childrenPerFamily})
      </div>
      {view.children.length === 0 ? (
        <p className={hl.muted} style={{ marginTop: 0 }}>
          لا يوجد أطفال في العائلة بعد.
        </p>
      ) : (
        <div className={f.list} style={{ marginBottom: 12 }}>
          {view.children.map((c) => (
            <ChildRow key={c.id} familyId={view.id} c={c} canEdit={view.canEditChildren} />
          ))}
        </div>
      )}
      {view.canEditChildren &&
        (full ? (
          <p className={hl.muted}>تضم العائلة {FAMILY_LIMITS.childrenPerFamily} طفلًا، وهو الحدّ الأقصى.</p>
        ) : (
          <AddChild familyId={view.id} p={p} />
        ))}
    </div>
  );
}

function AddChild({ familyId, p }: { familyId: string; p: P }) {
  const [state, action, pending] = useActionState<FamilyState, FormData>(createChildAction, null);
  const [open, setOpen] = useState(false);
  // the form closes once the child is added (it stays open, with the message, on an error)
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state?.ok) setOpen(false);
  }
  if (!open) {
    return (
      <>
        {state?.ok && <div className={styles.okMsg}>{state.ok}</div>}
        <button type="button" className={hl.primaryBtn} onClick={() => setOpen(true)}>
          + إضافة طفل
        </button>
      </>
    );
  }
  return (
    <form action={action} className={f.confirm}>
      <input type="hidden" name="familyId" value={familyId} />
      <div className={styles.formField} style={{ margin: 0 }}>
        <label className={styles.fieldLabel} htmlFor="child-name">
          اسم الطفل
        </label>
        <input id="child-name" name="name" className={styles.input} maxLength={ACCOUNT_LIMITS.nameMax} required />
        <div className={styles.hint}>يدخل به الطفل مع رمز الدخول، {p("فاختر", "فاختاري")} اسمًا يعرفه</div>
      </div>
      <div className={styles.genderSwitch} role="radiogroup" aria-label="ولد أو بنت">
        <label>
          <input type="radio" name="gender" value="MALE" required />
          ولد
        </label>
        <label>
          <input type="radio" name="gender" value="FEMALE" />
          بنت
        </label>
      </div>
      {state?.error && <div className={hl.err}>{state.error}</div>}
      <div className={hl.actionsRow}>
        <button type="submit" className={hl.primaryBtn} disabled={pending}>
          {pending ? "جارٍ الإضافة…" : "إضافة"}
        </button>
        <button type="button" className={hl.ghostBtn} onClick={() => setOpen(false)}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

function ChildRow({ familyId, c, canEdit }: { familyId: string; c: ChildView; canEdit: boolean }) {
  const { pending, error, run } = useFamilyAction();
  const [confirm, setConfirm] = useState<"code" | "stop" | "delete" | null>(null);
  const [word, setWord] = useState("");
  const [copied, setCopied] = useState(false);
  const g = c.gender;
  const close = () => {
    setConfirm(null);
    setWord("");
  };
  return (
    <div className={f.row}>
      <div className={f.rowHead}>
        <span className={f.name}>{c.name}</span>
        <span className={f.tag}>{by(g, "ولد", "بنت")}</span>
        <Link href={`/rafiq/family/${familyId}/child/${c.id}`} className={hl.linkBtn}>
          {by(g, "فتح صفحته", "فتح صفحتها")} ←
        </Link>
      </div>

      {canEdit && (
        <div className={f.rowActions}>
          {c.code ? (
            <>
              <span>رمز الدخول:</span>
              <span className={f.code}>{c.code}</span>
              <button
                type="button"
                className={hl.linkBtn}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.code ?? "");
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "تم النسخ ✓" : "نسخ الرمز"}
              </button>
              <button type="button" className={hl.linkBtn} disabled={pending} onClick={() => setConfirm("code")}>
                رمز جديد
              </button>
              <button type="button" className={styles.linkDanger} disabled={pending} onClick={() => setConfirm("stop")}>
                إيقاف الدخول
              </button>
            </>
          ) : (
            <>
              <span className={hl.muted}>الدخول موقوف</span>
              <button type="button" className={hl.linkBtn} disabled={pending} onClick={() => run(() => newChildCodeAction(familyId, c.id))}>
                {pending ? "جارٍ الإصدار…" : "إصدار رمز دخول"}
              </button>
            </>
          )}
          <button type="button" className={styles.linkDanger} disabled={pending} onClick={() => setConfirm("delete")}>
            {by(g, "حذف الطفل", "حذف الطفلة")}
          </button>
        </div>
      )}

      {confirm === "code" && (
        <div className={f.confirm}>
          <span>
            رمز جديد لـ{c.name}؟ يتوقّف الرمز الحالي، {by(g, "ويخرج", "وتخرج")} من {by(g, "حسابه", "حسابها")} على كل الأجهزة حتى {by(g, "يدخل", "تدخل")} بالرمز الجديد.
          </span>
          <div className={hl.actionsRow}>
            <button type="button" className={hl.primaryBtn} disabled={pending} onClick={() => run(() => newChildCodeAction(familyId, c.id), close)}>
              {pending ? "جارٍ الإصدار…" : "نعم، رمز جديد"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={close}>
              تراجع
            </button>
          </div>
        </div>
      )}
      {confirm === "stop" && (
        <div className={f.confirm}>
          <span>
            إيقاف دخول {c.name}؟ {by(g, "يخرج", "تخرج")} من {by(g, "حسابه", "حسابها")} على كل الأجهزة، ولا {by(g, "يستطيع", "تستطيع")} الدخول حتى يُصدَر رمز جديد. تبقى {by(g, "بياناته", "بياناتها")} كما هي.
          </span>
          <div className={hl.actionsRow}>
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => stopChildLoginAction(familyId, c.id), close)}>
              {pending ? "جارٍ الإيقاف…" : "نعم، إيقاف الدخول"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={close}>
              تراجع
            </button>
          </div>
        </div>
      )}
      {confirm === "delete" && (
        <div className={f.confirm}>
          <span>
            تُحذف صفحة {c.name} وجميع {by(g, "حفظه ومتابعته", "حفظها ومتابعتها")} نهائيًا، ولا يمكن التراجع عن ذلك.
          </span>
          <label className={styles.fieldLabel} htmlFor={`del-child-${c.id}`} style={{ margin: 0 }}>
            اكتب «{DELETE_CONFIRM_WORD}» للتأكيد
          </label>
          <input id={`del-child-${c.id}`} className={styles.input} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
          <div className={hl.actionsRow}>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={pending || word.trim() !== DELETE_CONFIRM_WORD}
              onClick={() => run(() => deleteChildAction(familyId, c.id, word), close)}
            >
              {pending ? "جارٍ الحذف…" : "حذف نهائيًا"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={close}>
              تراجع
            </button>
          </div>
        </div>
      )}
      {error && <div className={hl.err}>{error}</div>}
    </div>
  );
}

// ---------- invite رموز (founder) ----------

function Invites({ view, p }: { view: View; p: P }) {
  const { pending, error, run } = useFamilyAction();
  const valid = view.invites.filter((i) => i.state === "valid").length;
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        رموز الدعوة
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        {p("أرسل", "أرسلي")} الرمز أو رابط الدعوة إلى البالغ الذي {p("تريد", "تريدين")} ضمّه؛ يدخل بحسابه في رفيق الحفظ (أو ينشئ حسابًا) ثم ينضمّ. يصلح
        الرمز لأكثر من شخص مدة {INVITE_DAYS} أيام، {p("ويمكنك", "ويمكنكِ")} إلغاؤه في أي وقت.
      </p>
      {view.invites.length > 0 && (
        <div className={f.list} style={{ marginBottom: 12 }}>
          {view.invites.map((i) => (
            <InviteRow key={i.id} familyId={view.id} invite={i} />
          ))}
        </div>
      )}
      {error && <div className={hl.err} style={{ marginBottom: 10 }}>{error}</div>}
      <button
        type="button"
        className={hl.primaryBtn}
        disabled={pending || valid >= FAMILY_LIMITS.validInvites}
        onClick={() => run(() => createInviteAction(view.id))}
      >
        {pending ? "جارٍ الإنشاء…" : "+ إنشاء رمز دعوة"}
      </button>
    </div>
  );
}

function InviteRow({ familyId, invite }: { familyId: string; invite: InviteView }) {
  const today = useToday();
  const { pending, error, run } = useFamilyAction();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? invite.code : `${window.location.origin}/rafiq/family/join?code=${invite.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };
  // days are shown in her own time zone, so only once in the browser
  const until = today ? dayOfInstant(invite.expiresAt, null) : "";
  const valid = invite.state === "valid";
  return (
    <div className={f.row}>
      <div className={f.rowHead}>
        <span className={valid ? f.code : f.codeEnded}>{invite.code}</span>
        <span className={valid ? f.tagStrong : f.tag}>{valid ? `صالح حتى ${until}` : invite.state === "revoked" ? "مُلغى" : "منتهي"}</span>
      </div>
      {valid && (
        <div className={f.rowActions}>
          <button type="button" className={hl.linkBtn} onClick={() => copy("code")}>
            {copied === "code" ? "تم النسخ ✓" : "نسخ الرمز"}
          </button>
          <button type="button" className={hl.linkBtn} onClick={() => copy("link")}>
            {copied === "link" ? "تم النسخ ✓" : "نسخ رابط الدعوة"}
          </button>
          <button type="button" className={styles.linkDanger} disabled={pending} onClick={() => run(() => revokeInviteAction(familyId, invite.id))}>
            {pending ? "جارٍ الإلغاء…" : "إلغاء الرمز"}
          </button>
        </div>
      )}
      {error && <div className={hl.err}>{error}</div>}
    </div>
  );
}

// ---------- settings ----------

function Rename({ view }: { view: View }) {
  const { pending, error, run } = useFamilyAction();
  const [name, setName] = useState(view.name);
  const [saved, setSaved] = useState(false);
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        اسم العائلة
      </div>
      <div className={styles.formField}>
        <input
          aria-label="اسم العائلة"
          className={styles.input}
          value={name}
          maxLength={FAMILY_LIMITS.nameMax}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </div>
      {error && <div className={hl.err} style={{ marginBottom: 10 }}>{error}</div>}
      {saved && !error && <div className={styles.okMsg}>تم حفظ اسم العائلة ✓</div>}
      <button
        type="button"
        className={hl.primaryBtn}
        disabled={pending || name.trim() === view.name}
        onClick={() => run(() => renameFamilyAction(view.id, name), () => setSaved(true))}
      >
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </div>
  );
}

function Leave({ view, p }: { view: View; p: P }) {
  const { pending, error, run } = useFamilyAction();
  const [open, setOpen] = useState(false);
  return (
    <div className={hl.section}>
      <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
        مغادرة العائلة
      </div>
      {open ? (
        <div className={f.confirm}>
          <span>
            {p("ستفقد", "ستفقدين")} الوصول إلى بيانات الأطفال في «{view.name}»، {p("ويمكنك", "ويمكنكِ")} الانضمام مجددًا برمز دعوة جديد. تبقى صفحتك في رفيق الحفظ كما هي.
          </span>
          {error && <div className={hl.err}>{error}</div>}
          <div className={hl.actionsRow}>
            <button type="button" className={styles.dangerBtn} disabled={pending} onClick={() => run(() => leaveFamilyAction(view.id))}>
              {pending ? "جارٍ المغادرة…" : "نعم، مغادرة العائلة"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setOpen(false)}>
              تراجع
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={hl.ghostBtn} onClick={() => setOpen(true)}>
          مغادرة العائلة
        </button>
      )}
    </div>
  );
}

function DeleteFamily({ view, p }: { view: View; p: P }) {
  const [state, action, pending] = useActionState<FamilyState, FormData>(deleteFamilyAction, null);
  const [open, setOpen] = useState(false);
  return (
    <div className={hl.section}>
      <div className={`${hl.sectionTitle} ${styles.dangerTitle}`} style={{ margin: "0 0 8px" }}>
        حذف العائلة
      </div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        تُحذف العائلة وجميع الأطفال فيها وبياناتهم نهائيًا (عدد الأطفال: {view.childrenCount})، ولا يمكن التراجع عن ذلك. لا يتغيّر شيء في صفحات البالغين في رفيق
        الحفظ.
      </p>
      {open ? (
        <form action={action}>
          <input type="hidden" name="familyId" value={view.id} />
          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="fam-del-word">
              {p("اكتب", "اكتبي")} «{DELETE_CONFIRM_WORD}» للتأكيد
            </label>
            <input id="fam-del-word" name="confirmWord" className={styles.input} autoComplete="off" required />
          </div>
          <div className={styles.formField}>
            <label className={styles.fieldLabel} htmlFor="fam-del-current">
              كلمة المرور الحالية
            </label>
            <input id="fam-del-current" name="current" type="password" className={styles.input} autoComplete="current-password" required />
          </div>
          {state?.error && <div className={hl.err} style={{ marginBottom: 10 }}>{state.error}</div>}
          <div className={hl.actionsRow}>
            <button type="submit" className={styles.dangerBtn} disabled={pending}>
              {pending ? "جارٍ الحذف…" : "حذف العائلة نهائيًا"}
            </button>
            <button type="button" className={hl.ghostBtn} onClick={() => setOpen(false)}>
              تراجع
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={hl.ghostBtn} onClick={() => setOpen(true)}>
          حذف العائلة
        </button>
      )}
    </div>
  );
}
