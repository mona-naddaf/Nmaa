"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./work.module.css";
import { segmentTitle } from "@/components/home-log/TargetProgress";
import { useToday } from "@/lib/calendar/useToday";
import { countdownLabel, daysBetween, gregorianLabel } from "@/lib/calendar/hijri";
import { HOME_TAP_ICON, HOME_TAP_KINDS, HOME_TAP_LABEL, targetFor } from "@/lib/home-log/rules";
import { ASSIGNMENT_TYPE_ICON, ASSIGNMENT_TYPE_LABEL, isOverdue } from "@/lib/assignments/rules";
import type { StudentAssignment } from "@/lib/assignments/data";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

/** Her local calendar day of a timestamp (browser time zone). */
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * One student's assignments: open first, then done. With onToggle (her own
 * tab) each card has the big ✓; without it (staff, parent) it's read-only.
 * linkSegments: QURAN cards link to her «واجب» segment in the home log.
 */
export function AssignmentList({
  assignments,
  groupGender: g,
  onToggle,
  linkSegments = false,
}: {
  assignments: StudentAssignment[];
  groupGender: GroupGender;
  onToggle?: (id: string, done: boolean) => Promise<{ error?: string }>;
  linkSegments?: boolean;
}) {
  const today = useToday();
  // optimistic ticks, dropped once the server's list catches up
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const p = (m: string, f: string) => pickByGroup(g, { m, f });

  const isDone = (a: StudentAssignment) => override[a.id] ?? a.done;
  const open = assignments.filter((a) => !isDone(a));
  const done = assignments.filter((a) => isDone(a));

  function toggle(a: StudentAssignment) {
    if (!onToggle) return;
    const next = !isDone(a);
    setError(null);
    setOverride((o) => ({ ...o, [a.id]: next }));
    startTransition(async () => {
      const r = await onToggle(a.id, next);
      if (r.error) setError(r.error);
      setOverride((o) => {
        const { [a.id]: _dropped, ...rest } = o;
        void _dropped;
        return rest;
      });
    });
  }

  if (assignments.length === 0) {
    return (
      <div className={hl.section}>
        <div className={hl.empty}>لا توجد واجبات حاليًا.</div>
      </div>
    );
  }

  const card = (a: StudentAssignment) => {
    const d = isDone(a);
    let due: React.ReactNode = null;
    if (a.dueDate && !d) {
      if (today && isOverdue(a.dueDate, today)) due = <span className={styles.overdue}>كان موعده {gregorianLabel(a.dueDate)}</span>;
      else if (today) due = <span>التسليم: {countdownLabel(daysBetween(today, a.dueDate))}</span>;
      else due = <span>التسليم: {gregorianLabel(a.dueDate)}</span>;
    }
    const seg = a.segment;
    const segBody = seg && a.range && (
      <>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {segmentTitle(a.range)}
          {seg.targetsMet && <span className={hl.badge}>🎉 أُنجزت الأهداف</span>}
          {seg.finished && !seg.targetsMet && <span className={hl.badge}>أُتمّ</span>}
        </div>
        <div className={styles.meta} style={{ marginTop: 6 }}>
          {HOME_TAP_KINDS.map((k) => (
            <span key={k} title={HOME_TAP_LABEL[k]}>
              {HOME_TAP_ICON[k]} {seg.counts[k]}/{targetFor(seg.targets, k)}
            </span>
          ))}
        </div>
      </>
    );

    return (
      <div key={a.id} className={`${styles.card} ${d ? styles.done : ""}`}>
        <div className={styles.cardHead}>
          <div className={styles.cardMain}>
            <div className={styles.cardTitle}>
              {ASSIGNMENT_TYPE_ICON[a.type]} {a.title}
            </div>
            <div className={styles.meta}>
              <span className={styles.tag}>{ASSIGNMENT_TYPE_LABEL[a.type]}</span>
              {a.range && !seg && <span>{segmentTitle(a.range)}</span>}
              {due}
              {d && a.doneAt && today && <span>✓ أُنجز {gregorianLabel(localDay(a.doneAt))}</span>}
            </div>
          </div>
          {onToggle ? (
            <div>
              <button
                type="button"
                className={`${styles.tick} ${d ? styles.on : ""}`}
                onClick={() => toggle(a)}
                aria-pressed={d}
                aria-label={d ? `إلغاء علامة الإنجاز: ${a.title}` : `أنجزتُ: ${a.title}`}
              >
                ✓
              </button>
              <div className={styles.tickLabel}>{d ? "تمّ" : "أنجزتُه؟"}</div>
            </div>
          ) : (
            <span className={`${styles.tag} ${d ? styles.green : styles.grey}`}>{d ? "✓ أُنجز" : "لم يُنجز بعد"}</span>
          )}
        </div>
        {a.description && <div className={styles.desc}>{a.description}</div>}
        {segBody &&
          (linkSegments && !seg!.finished ? (
            <Link href={`/student/home-log/${seg!.id}`} className={styles.segLink}>
              {segBody}
              <div className={hl.linkBtn} style={{ marginTop: 6 }}>
                {p("افتح المقطع للتدريب ←", "افتحي المقطع للتدريب ←")}
              </div>
            </Link>
          ) : (
            <div className={styles.segLink}>{segBody}</div>
          ))}
      </div>
    );
  };

  return (
    <div>
      {error && (
        <div className={hl.err} role="alert" style={{ margin: "0 4px 10px" }}>
          {error}
        </div>
      )}
      {open.length > 0 && (
        <>
          <div className={hl.sectionTitle}>مفتوحة ({open.length})</div>
          <div className={styles.list} style={{ marginBottom: 16 }}>
            {open.map(card)}
          </div>
        </>
      )}
      {open.length === 0 && onToggle && (
        <div className={hl.celebrate} role="status" style={{ marginBottom: 16 }}>
          🌟 {p("أحسنتَ! أنجزتَ كل واجباتك", "أحسنتِ! أنجزتِ كل واجباتك")}
        </div>
      )}
      {done.length > 0 && (
        <>
          <div className={hl.sectionTitle}>منجزة ({done.length})</div>
          <div className={styles.list}>{done.map(card)}</div>
        </>
      )}
    </div>
  );
}
