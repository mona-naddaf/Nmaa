"use client";

import { useRef, useState } from "react";
import hl from "@/components/home-log/home-log.module.css";
import styles from "./agenda.module.css";
import { moveId } from "@/lib/tracker/agenda";

export type OrderEntry = { id: string; title: string; note?: string };

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
}: {
  // the instruction, worded for whoever reads it
  hint: string;
  entries: OrderEntry[];
  pending: boolean;
  error?: string | null;
  onSave: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const [moved, setIds] = useState(() => entries.map((e) => e.id));
  // if the items change while the list is open (a refresh), keep her moves
  // for the ones still there and add any new ones at the end
  const ids = [...moved.filter((id) => byId.has(id)), ...entries.map((e) => e.id).filter((id) => !moved.includes(id))];
  const [dragId, setDragId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const changed = ids.some((id, i) => id !== entries[i]?.id);

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
              <button type="button" className={`${styles.arrow} pressable`} aria-label={`نقل «${e.title}» إلى أعلى`} disabled={i === 0 || pending} onClick={() => setIds(moveId(ids, id, -1))}>
                ▲
              </button>
              <button
                type="button"
                className={`${styles.arrow} pressable`}
                aria-label={`نقل «${e.title}» إلى أسفل`}
                disabled={i === ids.length - 1 || pending}
                onClick={() => setIds(moveId(ids, id, 1))}
              >
                ▼
              </button>
            </div>
          );
        })}
      </div>
      {error && <div className={hl.err}>{error}</div>}
      <div className={hl.actionsRow} style={{ marginTop: 10 }}>
        <button type="button" className={`${hl.primaryBtn} pressable`} disabled={pending || !changed} onClick={() => onSave(ids)}>
          {pending ? "جارٍ الحفظ…" : "حفظ الترتيب"}
        </button>
        <button type="button" className={`${hl.ghostBtn} pressable`} disabled={pending} onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
