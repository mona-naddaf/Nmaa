"use client";

import { useState } from "react";
import styles from "./notes.module.css";
import { TagChip } from "./TagChip";
import { deleteTagAction, saveTagAction } from "./actions";
import { NOTE_COLOR_KEYS, NOTE_COLORS, NOTE_LIMITS, notesCountText, type NoteColor, type NoteTag } from "@/lib/rafiq/notes-rules";

// Her tags on «ملاحظاتي»: add, rename, recolour, delete. Deleting a tag only
// takes it off her notes; the notes stay.
export function TagManager({ tags, counts }: { tags: NoteTag[]; counts: Record<string, number> }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const full = tags.length >= NOTE_LIMITS.tagsPerAccount;

  async function remove(id: string) {
    setError(null);
    const r = await deleteTagAction(id);
    if (r.error) setError(r.error);
    setConfirmDelete(null);
  }

  return (
    <div>
      {tags.length === 0 && editing !== "new" && <div className={styles.counter}>لا توجد وسوم بعد.</div>}
      {tags.map((t) =>
        editing === t.id ? (
          <TagForm
            key={t.id}
            initial={t}
            onCancel={() => setEditing(null)}
            onSave={async (v) => {
              const r = await saveTagAction({ id: t.id, ...v });
              if (!r.error) setEditing(null);
              return r;
            }}
          />
        ) : (
          <div key={t.id} className={styles.tagRow}>
            <TagChip tag={t} />
            <span className={styles.counter}>{notesCountText(counts[t.id] ?? 0)}</span>
            <span className={styles.spacer} />
            {confirmDelete === t.id ? (
              <>
                <span className={styles.counter}>
                  سيُزال الوسم من ملاحظاته، وتبقى الملاحظات. حذف؟
                </span>
                <button type="button" className={styles.dangerBtn} onClick={() => remove(t.id)}>
                  نعم، حذف
                </button>
                <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(null)}>
                  تراجع
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.linkBtn} onClick={() => setEditing(t.id)}>
                  تعديل
                </button>
                <button type="button" className={styles.dangerBtn} onClick={() => setConfirmDelete(t.id)}>
                  حذف
                </button>
              </>
            )}
          </div>
        ),
      )}
      {error && <div className={styles.err}>{error}</div>}
      {editing === "new" ? (
        <TagForm
          initial={{ name: "", color: NOTE_COLOR_KEYS.find((k) => !tags.some((t) => t.color === k)) ?? "sage" }}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            const r = await saveTagAction(v);
            if (!r.error) setEditing(null);
            return r;
          }}
        />
      ) : (
        <div className={styles.formRow}>
          <button type="button" className={styles.ghostBtn} disabled={full} onClick={() => setEditing("new")}>
            + وسم جديد
          </button>
          {full && <span className={styles.counter}>وصلت الوسوم إلى حدّها ({NOTE_LIMITS.tagsPerAccount}).</span>}
        </div>
      )}
    </div>
  );
}

function TagForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { name: string; color: NoteColor };
  onSave: (v: { name: string; color: NoteColor }) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState<NoteColor>(initial.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const r = await onSave({ name, color });
    setSaving(false);
    if (r.error) setError(r.error);
  }

  return (
    <div className={styles.form} style={{ marginTop: 10 }}>
      <input
        className={styles.input}
        value={name}
        maxLength={NOTE_LIMITS.tagNameMax}
        placeholder="اسم الوسم، مثل: ربط"
        aria-label="اسم الوسم"
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && save()}
      />
      <div className={styles.formLabel}>اللون</div>
      <div className={styles.swatches} role="radiogroup" aria-label="اللون">
        {NOTE_COLOR_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={color === k}
            aria-label={NOTE_COLORS[k].name}
            title={NOTE_COLORS[k].name}
            className={`${styles.swatch} ${color === k ? styles.swatchOn : ""}`}
            style={{ background: NOTE_COLORS[k].dot }}
            onClick={() => setColor(k)}
          />
        ))}
      </div>
      <div className={styles.formLabel}>المعاينة</div>
      <TagChip tag={{ name: name.trim() || "الوسم", color }} />
      {error && <div className={styles.err}>{error}</div>}
      <div className={styles.formRow}>
        <button type="button" className={styles.primaryBtn} disabled={saving || !name.trim()} onClick={save}>
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
