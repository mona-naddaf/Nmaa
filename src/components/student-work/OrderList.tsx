"use client";

import { useRef, useState } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./agenda.module.css";
import { moveId } from "@/lib/tracker/agenda";
import { inertClass, inertProps } from "@/components/nudge/nudge";

export type OrderEntry = { id: string; title: string; note?: string };

/**
 * Rafiq and «العائلة» (unset elsewhere: as before): ▲ on the first item and ▼
 * on the last stay visible but inactive, with a tooltip, and «حفظ الترتيب»
 * with nothing moved says so (unchanged) instead of being disabled.
 */
export type OrderListLive = { unchanged: string };

/**
 * Reordering a list: drag the ⠿ handle (mouse, pen or finger — pointer
 * events, no library) or use ▲ ▼. Nothing is saved until «حفظ الترتيب».
 */
export function OrderList({
  hint,
  entries,
  pending,
  error,
  onSave,
  onCancel,
  live,
}: {
  // the instruction, worded for whoever reads it
  hint: string;
  entries: OrderEntry[];
  pending: boolean;
  error?: string | null;
  onSave: (ids: string[]) => void;
  onCancel: () => void;
  live?: OrderListLive;
}) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const [moved, setIds] = useState(() => entries.map((e) => e.id));
  // if the items change while the list is open (a refresh), keep her moves
  // for the ones still there and add any new ones at the end
  const ids = [...moved.filter((id) => byId.has(id)), ...entries.map((e) => e.id).filter((id) => !moved.includes(id))];
  const [dragId, setDragId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const changed = ids.some((id, i) => id !== entries[i]?.id);
  const [unchangedHint, setUnchangedHint] = useState(false);
  /** ▲ or ▼ at the end of the list: disabled, or (live) inactive with a tooltip. */
  const arrow = (atEnd: boolean, why: string) => (live ? { ...inertProps(atEnd, why), disabled: pending } : { disabled: atEnd || pending });
  const arrowClass = (atEnd: boolean) => (live && atEnd ? `${styles.arrow} pressable ${inertClass}` : `${styles.arrow} pressable`);

  function onMove(e: React.PointerEvent) {
    if (!dragId) return;
    // the row under the pointer takes the dragged item's place
    for (const [id, el] of rows.current) {
      if (id === dragId) continue;
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) {
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(id);
        // move only once the pointer passes the row's middle, so it doesn't flicker
        const middle = r.top + r.height / 2;
        if ((to > from && e.clientY > middle) || (to < from && e.clientY < middle)) {
          const next = ids.filter((x) => x !== dragId);
          next.splice(to, 0, dragId);
          setIds(next);
        }
        break;
      }
    }
  }

  return (
    <div className={hl.section}>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        {hint}
      </p>
      <div onPointerMove={onMove} onPointerUp={() => setDragId(null)} onPointerCancel={() => setDragId(null)}>
        {ids.map((id, i) => {
          const e = byId.get(id)!;
          return (
            <div
              key={id}
              ref={(el) => {
                if (el) rows.current.set(id, el);
                else rows.current.delete(id);
              }}
              className={`${styles.orderRow} ${dragId === id ? styles.dragging : ""}`}
            >
              <span
                className={styles.handle}
                aria-hidden
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  (ev.currentTarget.parentElement?.parentElement as HTMLElement | null)?.setPointerCapture?.(ev.pointerId);
                  setDragId(id);
                }}
              >
                ⠿
              </span>
              <span className={styles.orderTitle}>
                {e.title}
                {e.note && <small>{e.note}</small>}
              </span>
              <button type="button" className={arrowClass(i === 0)} aria-label={`نقل «${e.title}» إلى أعلى`} {...arrow(i === 0, "هذا أول بند")} onClick={() => setIds(moveId(ids, id, -1))}>
                ▲
              </button>
              <button
                type="button"
                className={arrowClass(i === ids.length - 1)}
                aria-label={`نقل «${e.title}» إلى أسفل`}
                {...arrow(i === ids.length - 1, "هذا آخر بند")}
                onClick={() => setIds(moveId(ids, id, 1))}
              >
                ▼
              </button>
            </div>
          );
        })}
      </div>
      {error && <div className={hl.err}>{error}</div>}
      {live && unchangedHint && !changed && (
        <div className={hl.err} role="status">
          {live.unchanged}
        </div>
      )}
      <div className={hl.actionsRow} style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`${hl.primaryBtn} pressable`}
          disabled={pending || (!live && !changed)}
          onClick={() => {
            if (!changed) return setUnchangedHint(true);
            setUnchangedHint(false);
            onSave(ids);
          }}
        >
          {pending ? "جارٍ الحفظ…" : "حفظ الترتيب"}
        </button>
        <button type="button" className={`${hl.ghostBtn} pressable`} disabled={pending} onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
