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
import type { FamilyView as View, InviteView, MemberView } from "@/lib/family/data";
import { pickByPerson, type PersonGender } from "@/lib/text/gender";
import {
  createInviteAction,
  deleteFamilyAction,
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

export function FamilyView({ view, gender }: { view: View; gender: PersonGender }) {
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

      <Adults view={view} p={p} />

      <div className={hl.section}>
        <div className={hl.sectionTitle} style={{ margin: "0 0 8px" }}>
          الأطفال
        </div>
        <p className={hl.muted} style={{ margin: 0 }}>
          {view.childrenCount === 0 ? "لا يوجد أطفال في العائلة بعد." : `عدد الأطفال: ${view.childrenCount}.`} إضافة الأطفال قريبًا.
        </p>
      </div>

      {view.isFounder && <Invites view={view} p={p} />}
      {view.isFounder && <Rename view={view} />}
      {!view.isFounder && me && <Leave view={view} p={p} />}
      {view.isFounder && <DeleteFamily view={view} p={p} />}
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
  return (
    <div className={f.row}>
      <div className={f.rowHead}>
        <span className={f.name}>
          {m.name}
          {m.isMe && " (أنا)"}
        </span>
        <span className={m.isFounder ? f.tagStrong : f.tag}>{m.isFounder ? by(g, "المؤسِّس", "المؤسِّسة") : by(g, "بالغ", "بالغة")}</span>
        {!m.isFounder && <span className={f.tag}>{m.canEditChildren ? by(g, "يستطيع تعديل بيانات الأطفال", "تستطيع تعديل بيانات الأطفال") : "مشاهدة فقط"}</span>}
        {m.email && <span className={f.email}>{m.email}</span>}
      </div>

      {founderView && !m.isFounder && (
        <div className={f.rowActions}>
          <label className={f.check}>
            <input
              type="checkbox"
              checked={m.canEditChildren}
              disabled={pending}
              onChange={(e) => {
                const on = e.target.checked;
                run(() => setEditRightsAction(familyId, m.userId, on));
              }}
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
