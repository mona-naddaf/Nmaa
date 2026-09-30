"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./settings.module.css";
import { addGroupAction, deleteGroupAction, renameGroupAction, setGroupGenderAction } from "./actions";
import { pickByGroup, studentsNoun, type GroupGender } from "@/lib/text/gender";

const GENDER_LABEL: Record<GroupGender, string> = { GIRLS: "بنات", BOYS: "بنين", MIXED: "مختلطة" };
const GENDER_OPTIONS: GroupGender[] = ["GIRLS", "BOYS", "MIXED"];

export function GroupsEditor({ groups }: { groups: { id: string; name: string; gender: GroupGender }[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  const [newGender, setNewGender] = useState<GroupGender>("GIRLS");
  // a delete that first needs a destination for the group's archived students
  const [moving, setMoving] = useState<{ groupId: string; count: number; target: string } | null>(null);

  function commitRename(id: string, value: string, original: string) {
    if (value.trim() === original || !value.trim()) return;
    startTransition(async () => {
      await renameGroupAction(id, value);
      router.refresh();
    });
  }

  function changeGender(id: string, gender: GroupGender) {
    startTransition(async () => {
      await setGroupGenderAction(id, gender);
      router.refresh();
    });
  }

  function remove(id: string, moveArchivedTo?: string) {
    startTransition(async () => {
      const result = await deleteGroupAction(id, moveArchivedTo);
      if (result?.error) {
        setError(result.error);
      } else if (result?.archivedToMove) {
        setError(null);
        const firstOther = groups.find((g) => g.id !== id)?.id ?? "";
        setMoving({ groupId: id, count: result.archivedToMove, target: firstOther });
      } else {
        setError(null);
        setMoving(null);
        router.refresh();
      }
    });
  }

  const movingGroup = moving ? groups.find((g) => g.id === moving.groupId) : null;

  function add() {
    const value = newNameRef.current?.value ?? "";
    if (!value.trim()) return;
    startTransition(async () => {
      await addGroupAction(value, newGender);
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
            <select value={g.gender} onChange={(e) => changeGender(g.id, e.target.value as GroupGender)}>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {GENDER_LABEL[opt]}
                </option>
              ))}
            </select>
            <button className={styles.removeBtn} onClick={() => remove(g.id)} title="حذف المجموعة" type="button">
              ×
            </button>
          </div>
        ))}
      </div>
      {moving && movingGroup && (
        <div className={styles.assignBox} style={{ marginBottom: 12 }}>
          <div className={styles.aTitle}>
            في مجموعة «{movingGroup.name}» {moving.count} من {studentsNoun(movingGroup.gender)} الأرشيف. إلى أي
            مجموعة يُنقَل{pickByGroup(movingGroup.gender, { m: "ون", f: "ن" })} قبل حذفها؟ (تبقى بيانات
            {pickByGroup(movingGroup.gender, { m: "هم", f: "هنّ" })} محفوظة، وتظهر في المجموعة الجديدة عند الاستعادة)
          </div>
          <div className={styles.editRow}>
            <select value={moving.target} onChange={(e) => setMoving({ ...moving, target: e.target.value })}>
              {groups
                .filter((g) => g.id !== moving.groupId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
            <button className={styles.addBtn} style={{ padding: "8px 14px" }} type="button" onClick={() => remove(moving.groupId, moving.target)}>
              نقل وحذف المجموعة
            </button>
            <button className={styles.copyBtn} style={{ marginTop: 0 }} type="button" onClick={() => setMoving(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      {error && <div className={styles.err}>{error}</div>}
      <div className={styles.addNewRow}>
        <input ref={newNameRef} type="text" placeholder="اسم مجموعة جديدة..." />
        <select value={newGender} onChange={(e) => setNewGender(e.target.value as GroupGender)}>
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {GENDER_LABEL[opt]}
            </option>
          ))}
        </select>
        <button className={styles.addBtn} onClick={add} type="button">
          إضافة مجموعة
        </button>
      </div>
    </div>
  );
}
