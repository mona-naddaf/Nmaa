"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";
import {
  addPointsActivityAction,
  deletePointsActivityAction,
  renamePointsActivityAction,
  updatePointsActivityTypeAction,
  updatePointsActivityValueAction,
} from "./actions";

type Activity = { id: string; name: string; value: number; type: "ADD" | "SUBTRACT" };

export function PointsEditor({ activities }: { activities: Activity[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const newNameRef = useRef<HTMLInputElement>(null);
  const newValueRef = useRef<HTMLInputElement>(null);
  const newTypeRef = useRef<HTMLSelectElement>(null);

  function commitRename(id: string, value: string, original: string) {
    if (value.trim() === original || !value.trim()) return;
    startTransition(async () => {
      await renamePointsActivityAction(id, value);
      router.refresh();
    });
  }

  function commitValue(id: string, value: string, original: number) {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num === original) return;
    startTransition(async () => {
      await updatePointsActivityValueAction(id, num);
      router.refresh();
    });
  }

  function changeType(id: string, type: "ADD" | "SUBTRACT") {
    startTransition(async () => {
      await updatePointsActivityTypeAction(id, type);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deletePointsActivityAction(id);
      router.refresh();
    });
  }

  function add() {
    const name = newNameRef.current?.value ?? "";
    const value = parseInt(newValueRef.current?.value ?? "1", 10) || 1;
    const type = (newTypeRef.current?.value ?? "ADD") as "ADD" | "SUBTRACT";
    if (!name.trim()) return;
    startTransition(async () => {
      await addPointsActivityAction(name, value, type);
      if (newNameRef.current) newNameRef.current.value = "";
      if (newValueRef.current) newValueRef.current.value = "1";
      router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.editList}>
        {activities.map((a) => (
          <div className={styles.editRow} key={a.id}>
            <input type="text" defaultValue={a.name} onBlur={(e) => commitRename(a.id, e.target.value, a.name)} />
            <input
              type="number"
              min={1}
              defaultValue={a.value}
              onBlur={(e) => commitValue(a.id, e.target.value, a.value)}
            />
            <select value={a.type} onChange={(e) => changeType(a.id, e.target.value as "ADD" | "SUBTRACT")}>
              <option value="ADD">إضافة</option>
              <option value="SUBTRACT">خصم</option>
            </select>
            <button className={styles.removeBtn} onClick={() => remove(a.id)} title="حذف النشاط" type="button">
              ×
            </button>
          </div>
        ))}
      </div>
      <div className={styles.addNewRow}>
        <input ref={newNameRef} type="text" placeholder="اسم نشاط جديد..." />
        <input ref={newValueRef} type="number" defaultValue={1} style={{ width: 60 }} />
        <select ref={newTypeRef} defaultValue="ADD">
          <option value="ADD">إضافة</option>
          <option value="SUBTRACT">خصم</option>
        </select>
        <button className={styles.addBtn} onClick={add} type="button">
          إضافة
        </button>
      </div>
    </div>
  );
}
