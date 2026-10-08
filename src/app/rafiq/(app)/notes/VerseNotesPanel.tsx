"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./notes.module.css";
import { TagChip } from "./TagChip";
import { deleteNoteAction, loadVerseNotesAction, saveNoteAction } from "./actions";
import { NOTE_LIMITS, type NoteTag, type VerseNote } from "@/lib/rafiq/notes-rules";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// One verse's notes: list, add, edit, delete, tags. Used in the verse dialog
// (from a marker) and on the verse page.
export function VerseNotesPanel({ surah, ayah, g }: { surah: number; ayah: number; g: GroupGender }) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [data, setData] = useState<{ notes: VerseNote[]; tags: NoteTag[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await loadVerseNotesAction(surah, ayah);
    if ("error" in r) setLoadError(r.error);
    else {
      setLoadError(null);
      setData(r);
    }
    return r;
  }, [surah, ayah]);

  useEffect(() => {
    let alive = true;
    loadVerseNotesAction(surah, ayah).then((r) => {
      if (!alive) return;
      if ("error" in r) setLoadError(r.error);
      else setData(r);
    });
    return () => {
      alive = false;
    };
  }, [surah, ayah]);

  if (loadError) return <div className={styles.err}>{loadError}</div>;
  if (!data) return <div className={styles.counter}>جارٍ التحميل…</div>;

  const tagById = new Map(data.tags.map((t) => [t.id, t]));
  const full = data.notes.length >= NOTE_LIMITS.perVerse;

  async function remove(id: string) {
    setError(null);
    const r = await deleteNoteAction(id);
    if (r.error) setError(r.error);
    setConfirmDelete(null);
    await load();
  }

  return (
    <div>
      {editing === "new" ? (
        <NoteForm
          g={g}
          tags={data.tags}
          initial={{ text: "", tagIds: [] }}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            const r = await saveNoteAction({ surahNumber: surah, ayah, ...v });
            if (!r.error) {
              setEditing(null);
              await load();
            }
            return r;
          }}
        />
      ) : (
        <div className={styles.formRow} style={{ marginTop: 0, marginBottom: 12 }}>
          <button type="button" className={styles.primaryBtn} disabled={full} onClick={() => setEditing("new")}>
            + ملاحظة جديدة
          </button>
          {full && <span className={styles.counter}>وصلت ملاحظات هذه الآية إلى حدّها ({NOTE_LIMITS.perVerse}).</span>}
        </div>
      )}

      {error && <div className={styles.err}>{error}</div>}

      {data.notes.length === 0 && editing !== "new" && (
        <div className={styles.counter} style={{ padding: "6px 2px 4px" }}>
          لا توجد ملاحظات على هذه الآية بعد — {p("يمكنك", "يمكنكِ")} تدوين متشابهاتها أو تدبّرك أو تفسيرها.
        </div>
      )}

      {data.notes.map((n) =>
        editing === n.id ? (
          <NoteForm
            key={n.id}
            g={g}
            tags={data.tags}
            initial={{ text: n.text, tagIds: n.tagIds }}
            onCancel={() => setEditing(null)}
            onSave={async (v) => {
              const r = await saveNoteAction({ id: n.id, surahNumber: surah, ayah, ...v });
              if (!r.error) {
                setEditing(null);
                await load();
              }
              return r;
            }}
          />
        ) : (
          <div key={n.id} className={styles.note}>
            <div className={styles.noteText}>{n.text}</div>
            <div className={styles.noteMeta}>
              <div className={styles.chips}>
                {n.tagIds.map((id) => {
                  const t = tagById.get(id);
                  return t ? <TagChip key={id} tag={t} /> : null;
                })}
              </div>
              <span className={styles.spacer} />
              <bdi dir="ltr">{n.updatedAt.slice(0, 10)}</bdi>
              {confirmDelete === n.id ? (
                <>
                  <span>حذف هذه الملاحظة؟</span>
                  <button type="button" className={styles.dangerBtn} onClick={() => remove(n.id)}>
                    نعم، حذف
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(null)}>
                    تراجع
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.linkBtn} onClick={() => setEditing(n.id)}>
                    تعديل
                  </button>
                  <button type="button" className={styles.dangerBtn} onClick={() => setConfirmDelete(n.id)}>
                    حذف
                  </button>
                </>
              )}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function NoteForm({
  g,
  tags,
  initial,
  onSave,
  onCancel,
}: {
  g: GroupGender;
  tags: NoteTag[];
  initial: { text: string; tagIds: string[] };
  onSave: (v: { text: string; tagIds: string[] }) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [text, setText] = useState(initial.text);
  // tags deleted since stay out
  const [tagIds, setTagIds] = useState(initial.tagIds.filter((id) => tags.some((t) => t.id === id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setTagIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const r = await onSave({ text, tagIds });
    setSaving(false);
    if (r.error) setError(r.error);
  }

  return (
    <div className={styles.form}>
      <textarea
        className={styles.textarea}
        value={text}
        maxLength={NOTE_LIMITS.textMax}
        placeholder={p("اكتب ملاحظتك…", "اكتبي ملاحظتك…")}
        aria-label="نصّ الملاحظة"
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.counter}>
        <bdi dir="ltr">
          {text.length} / {NOTE_LIMITS.textMax}
        </bdi>
      </div>
      <div className={styles.formLabel}>الوسوم (حتى {NOTE_LIMITS.tagsPerNote})</div>
      {tags.length === 0 ? (
        <div className={styles.counter}>
          لا توجد وسوم — {p("يمكنك", "يمكنكِ")} إضافتها من صفحة{" "}
          <Link href="/rafiq/notes" className={styles.linkBtn}>
            ملاحظاتي
          </Link>
          .
        </div>
      ) : (
        <div className={styles.chips}>
          {tags.map((t) => {
            const on = tagIds.includes(t.id);
            return (
              <TagChip
                key={t.id}
                tag={t}
                on={on}
                disabled={!on && tagIds.length >= NOTE_LIMITS.tagsPerNote}
                onClick={() => toggle(t.id)}
              />
            );
          })}
        </div>
      )}
      {error && <div className={styles.err}>{error}</div>}
      <div className={styles.formRow}>
        <button type="button" className={styles.primaryBtn} disabled={saving || !text.trim()} onClick={save}>
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
