"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkAttendanceAction, bulkPointAction, undoBulkAction, type BulkResult } from "./bulk-actions";
import styles from "./students.module.css";
import type { StudentSummary } from "@/lib/students/summary";
import { streakText } from "@/lib/students/streak";
import { MenuButton, type MenuItem } from "@/components/menu-button/MenuButton";
import {
  presentWord,
  absentWord,
  studentNoun,
  studentsNoun,
  studentNounDef,
  studentsNounDef,
  pickByGroup,
  imperative,
  type GroupGender,
  type PersonGender,
} from "@/lib/text/gender";

const ATTENDANCE_CLASS: Record<string, string> = { IN: "present", OUT: "absent", PENDING: "pending" };

export function StudentsList({
  groups,
  students,
  canAddStudents,
  isSupervisor,
  viewerGender,
  archivedCount = 0,
  canIssueStudentCodes = false,
  canUseOfflineSheet = false,
  pointsActivities = [],
}: {
  groups: { id: string; name: string; gender: GroupGender }[];
  students: StudentSummary[];
  canAddStudents: boolean;
  // bulk import, parent codes and the archive are supervisor-only
  isSupervisor: boolean;
  viewerGender: PersonGender;
  // supervisor only: how many students are in the archive
  archivedCount?: number;
  // student login on and the viewer may issue student codes
  canIssueStudentCodes?: boolean;
  // «التسميع بدون إنترنت» (the supervisor, or a teacher with the permission)
  canUseOfflineSheet?: boolean;
  // the course's point categories, for the «تحديد» bar's «+ نقطة»
  pointsActivities?: { id: string; name: string; value: number; type: "ADD" | "SUBTRACT" }[];
}) {
  const [activeGroup, setActiveGroup] = useState(groups[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const activeGender: GroupGender = groups.find((g) => g.id === activeGroup)?.gender ?? "MIXED";

  const attendanceLabel = (status: string) =>
    status === "IN" ? presentWord(activeGender) : status === "OUT" ? absentWord(activeGender) : "قيد الانتظار";

  // Only what the viewer may use (the pages behind them check again): parent
  // codes are supervisor-only; adding by hand or from Excel follows the
  // add-students permission. One allowed option turns the button into a
  // direct link labelled with it; none hides it.
  const codeItems: MenuItem[] = [
    ...(isSupervisor ? [{ href: "/students/parent-codes", label: "رموز أولياء الأمور" }] : []),
    ...(canIssueStudentCodes ? [{ href: "/students/student-codes", label: `رموز ${studentsNounDef(activeGender)}` }] : []),
  ];
  const addItems: MenuItem[] = [
    ...(canAddStudents
      ? [
          { href: "/students/new", label: "إضافة يدوية" },
          { href: "/students/import", label: "استيراد من Excel" },
        ]
      : []),
  ];
  const offlineItems: MenuItem[] = canUseOfflineSheet
    ? [
        { href: "/students/offline#download", label: "تنزيل الملف" },
        { href: "/students/offline#upload", label: "رفع الملف" },
      ]
    : [];

  // «تحديد»: today's attendance or a point for many students at once (bulk-actions.ts)
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unmarkedOnly, setUnmarkedOnly] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [bonusNote, setBonusNote] = useState("");
  const [notice, setNotice] = useState<{ text: string; undo: string | null; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  // «تراجع» has its own state: usable at once, even while the list refreshes
  const [undoing, setUndoing] = useState(false);
  // «تراجع» is offered for a few seconds
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.undo ? 10000 : 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return students.filter(
      (s) => s.groupId === activeGroup && (!q || s.name.includes(q)) && (!selecting || !unmarkedOnly || s.attendance === "PENDING"),
    );
  }, [students, activeGroup, query, selecting, unmarkedOnly]);

  // the selected students' groups decide the wording: gendered when they share one gender
  const selectedGenders = new Set(
    students.filter((s) => selected.has(s.id)).map((s) => groups.find((g) => g.id === s.groupId)?.gender ?? "MIXED"),
  );
  const oneGender: GroupGender | null = selectedGenders.size === 1 ? [...selectedGenders][0] : null;
  const allShownSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllShown() {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const s of filtered) {
        if (allShownSelected) next.delete(s.id);
        else next.add(s.id);
      }
      return next;
    });
  }
  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setUnmarkedOnly(false);
    setPointsOpen(false);
  }

  function run(action: () => Promise<BulkResult>, message: (done: number, skipped: number) => string) {
    setPointsOpen(false);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setNotice({ text: result.error, undo: null, error: true });
        return;
      }
      setNotice({ text: message(result.done, result.skipped), undo: result.done > 0 ? result.undo : null });
      router.refresh();
    });
  }
  const ids = () => [...selected];
  const markAttendance = (status: "IN" | "OUT") =>
    run(
      () => bulkAttendanceAction(ids(), status),
      (n) => `✓ سُجِّل ${status === "IN" ? "الحضور" : "الغياب"} لـ ${n}`,
    );
  const addPoint = (activity: { id: string; name: string } | null) =>
    run(
      () => bulkPointAction(ids(), activity?.id ?? null, activity ? "" : bonusNote),
      (n, skipped) => {
        const name = activity ? activity.name : "نقطة إضافية";
        if (n === 0) return `«${name}» مسجّلة اليوم من قبل لكل المحدَّدين (${skipped})`;
        return `✓ أُضيفت «${name}» لـ ${n}` + (skipped > 0 ? `، وكانت مسجّلة من قبل لـ ${skipped}` : "");
      },
    );
  async function undo(token: string) {
    if (undoing) return;
    setUndoing(true);
    try {
      const result = await undoBulkAction(token);
      if ("error" in result) {
        setNotice({ text: result.error, undo: null, error: true });
        return;
      }
      setNotice({
        text: `↩ تم التراجع عن ${result.undone}` + (result.kept > 0 ? `، وتُرك ${result.kept} لأن أحدًا عدّله بعد ذلك` : ""),
        undo: null,
      });
      setBonusNote("");
      router.refresh();
    } finally {
      setUndoing(false);
    }
  }

  const cardBody = (s: StudentSummary): ReactNode => (
    <>
      <div className={styles.gcTop}>
        <div className={styles.avatar}>{s.name.charAt(0)}</div>
        <div>
          <div className={styles.gcName}>{s.name}</div>
          <div className={styles.gcAge}>{s.age} سنوات</div>
        </div>
      </div>
      <div className={styles.gcPos}>
        آخر موقف: <b>{s.lastPositionText}</b>
      </div>
      {s.secondPositionText && (
        <div className={styles.gcPos}>
          المسار الثاني: <b>{s.secondPositionText}</b>
        </div>
      )}
      <div className={styles.gcFoot}>
        <div className={styles.attendDot}>
          <span className={`${styles.dot} ${styles[ATTENDANCE_CLASS[s.attendance]]}`} />
          {attendanceLabel(s.attendance)}
        </div>
        <div className={styles.footRight}>
          {!!s.streak && (
            <span className={styles.streakBadge} title={streakText(s.streak)} aria-label={streakText(s.streak)}>
              🔥 {s.streak}
            </span>
          )}
          {s.overdueReviewCount > 0 && (
            <span
              className={styles.reviewBadge}
              title={`${s.overdueReviewCount} سورة تحتاج مراجعة`}
              aria-label={`${s.overdueReviewCount} سورة تحتاج مراجعة`}
            >
              🔁 {s.overdueReviewCount}
            </span>
          )}
          <div className={styles.pointsBadge}>{s.cumPoints}</div>
        </div>
      </div>
    </>
  );

  return (
    <div>
      {(codeItems.length > 0 || addItems.length > 0 || offlineItems.length > 0) && (
        <div className={styles.actionsRow}>
          <MenuButton label="الرموز" items={codeItems} className={`${styles.addBtn} ${styles.secondaryBtn}`} />
          <MenuButton label="📄 تسميع بدون إنترنت" items={offlineItems} className={`${styles.addBtn} ${styles.secondaryBtn}`} />
          <MenuButton label={`+ إضافة ${studentNoun(activeGender)}`} items={addItems} className={styles.addBtn} primary />
        </div>
      )}

      <div className={styles.topRow}>
        <input
          className={styles.search}
          placeholder={`بحث باسم ${studentNounDef(activeGender)}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className={`${styles.selectBtn} ${selecting ? styles.selectBtnOn : ""}`}
          aria-pressed={selecting}
          onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
        >
          {selecting ? "إنهاء التحديد" : "تحديد"}
        </button>
      </div>

      {selecting && (
        <div className={styles.selectRow}>
          <button type="button" className={styles.selectChip} onClick={toggleAllShown} disabled={filtered.length === 0}>
            {allShownSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
          </button>
          <button
            type="button"
            className={`${styles.selectChip} ${unmarkedOnly ? styles.selectChipOn : ""}`}
            aria-pressed={unmarkedOnly}
            onClick={() => setUnmarkedOnly((v) => !v)}
          >
            من لم يُسجَّل حضوره بعد
          </button>
        </div>
      )}

      <div className={styles.tabs}>
        {groups.map((g) => (
          <div
            key={g.id}
            className={`${styles.tab} ${activeGroup === g.id ? styles.active : ""}`}
            onClick={() => setActiveGroup(g.id)}
          >
            {g.name}{" "}
            <span className={styles.count}>({students.filter((s) => s.groupId === g.id).length})</span>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>لا يوجد {studentsNoun(activeGender)} في هذه المجموعة بعد</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((s) =>
            selecting ? (
              <button
                key={s.id}
                type="button"
                role="checkbox"
                aria-checked={selected.has(s.id)}
                className={`${styles.girlCard} ${styles.selectCard} ${styles[`edge_${ATTENDANCE_CLASS[s.attendance]}`]} ${selected.has(s.id) ? styles.selectedCard : ""}`}
                onClick={() => toggle(s.id)}
              >
                <span className={styles.checkMark} aria-hidden="true">
                  {selected.has(s.id) ? "✓" : ""}
                </span>
                {cardBody(s)}
              </button>
            ) : (
              <Link key={s.id} href={`/students/${s.id}`} className={styles.girlCard}>
                {cardBody(s)}
              </Link>
            ),
          )}
        </div>
      )}

      <div className={styles.note}>
        {imperative(viewerGender, { m: "اضغط", f: "اضغطي" })} على بطاقة أي {studentNoun(activeGender)} لفتح شاشة
        التسميع الخاصة {pickByGroup(activeGender, { m: "به", f: "بها" })}
      </div>

      {selecting && selected.size > 0 && (
        <div className={styles.bulkBar} role="region" aria-label="إجراءات المحدَّدين">
          {pointsOpen && (
            <div className={styles.bulkPoints}>
              {pointsActivities.map((a) => (
                <button key={a.id} type="button" className={styles.bulkPointBtn} disabled={pending} onClick={() => addPoint(a)}>
                  {a.name} <span className={styles.bulkPointValue}>{a.type === "ADD" ? `+${a.value}` : `−${a.value}`}</span>
                </button>
              ))}
              <div className={styles.bulkBonus}>
                <input
                  className={styles.bulkBonusInput}
                  placeholder="سبب النقطة الإضافية (اختياري)"
                  value={bonusNote}
                  maxLength={200}
                  onChange={(e) => setBonusNote(e.target.value)}
                />
                <button type="button" className={styles.bulkPointBtn} disabled={pending} onClick={() => addPoint(null)}>
                  نقطة إضافية <span className={styles.bulkPointValue}>+1</span>
                </button>
              </div>
            </div>
          )}
          <div className={styles.bulkRow}>
            <span className={styles.bulkCount}>المحدَّدون: {selected.size}</span>
            <button type="button" className={`${styles.bulkBtn} ${styles.bulkIn}`} disabled={pending} onClick={() => markAttendance("IN")}>
              {oneGender ? presentWord(oneGender) : "تسجيل الحضور"}
            </button>
            <button type="button" className={`${styles.bulkBtn} ${styles.bulkOut}`} disabled={pending} onClick={() => markAttendance("OUT")}>
              {oneGender ? absentWord(oneGender) : "تسجيل الغياب"}
            </button>
            <button
              type="button"
              className={`${styles.bulkBtn} ${pointsOpen ? styles.bulkBtnOn : ""}`}
              aria-expanded={pointsOpen}
              disabled={pending}
              onClick={() => setPointsOpen((v) => !v)}
            >
              + نقطة
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className={`${styles.bulkNotice} ${notice.error ? styles.bulkNoticeError : ""}`} role="status">
          <span>{notice.text}</span>
          {notice.undo && (
            <button type="button" className={styles.bulkUndo} disabled={undoing} onClick={() => undo(notice.undo!)}>
              تراجع
            </button>
          )}
        </div>
      )}

      {isSupervisor && (
        <div className={styles.archiveRow}>
          <Link href="/students/archive" className={styles.archiveLink}>
            الأرشيف ({archivedCount})
          </Link>
        </div>
      )}
    </div>
  );
}
