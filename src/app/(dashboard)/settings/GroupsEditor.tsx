"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";
import { addGroupAction, deleteGroupAction, renameGroupAction } from "./actions";

export function GroupsEditor({ groups }: { groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  function commitRename(id: string, value: string, original: string) {
    if (value.trim() === original || !value.trim()) return;
    startTransition(async () => {
      await renameGroupAction(id, value);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteGroupAction(id);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  function add() {
    const value = newNameRef.current?.value ?? "";
    if (!value.trim()) return;
    startTransition(async () => {
      await addGroupAction(value);
      if (newNameRef.current) newNameRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div>
      <div className={styles.editList}>
        {groups.map((g) => (
          <div className={styles.editRow} key={g.id}>
            <input type="text" defaultValue={g.name} onBlur={(e) => commitRename(g.id, e.target.value, g.name)} />
            <button className={styles.removeBtn} onClick={() => remove(g.id)} title="حذف المجموعة" type="button">
              ×
            </button>
          </div>
        ))}
      </div>
      {error && <div className={styles.err}>{error}</div>}
      <div className={styles.addNewRow}>
        <input ref={newNameRef} type="text" placeholder="اسم مجموعة جديدة..." />
        <button className={styles.addBtn} onClick={add} type="button">
          إضافة مجموعة
        </button>
      </div>
    </div>
  );
}
