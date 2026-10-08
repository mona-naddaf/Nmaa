"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./notes.module.css";
import { TagChip } from "./TagChip";
import { deleteNoteAction, loadVerseNotesAction, saveNoteAction } from "./actions";
import { NOTE_LIMITS, type NoteTag, type VerseNote } from "@/lib/rafiq/notes-rules";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// One verse's notes: list, add, edit, delete, tags. Used in the verse dialog
// (from a marker) and on the verse page.
//
// A learner must never lose a note silently: every failed action (including
// a network drop or a stale page after a new deployment, which reject the
// action's promise) shows a message and keeps the form and its text; what she
// types is also kept as a draft on this device until it is saved, and comes
// back when she reopens the verse.

type Draft = { text: string; tagIds: string[] };
const draftKey = (surah: number, ayah: number, noteId: string) => `rafiq-note-draft:${surah}:${ayah}:${noteId}`;

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    const d = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
    return d && typeof d.text === "string" ? { text: d.text, tagIds: Array.isArray(d.tagIds) ? d.tagIds.filter((x) => typeof x === "string") : [] } : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, d: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {}
}
function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function VerseNotesPanel({
  surah,
  ayah,
  g,
  onDirtyChange,
}: {
  surah: number;
  ayah: number;
  g: GroupGender;
  /** true while a form holds unsaved text (the dialog asks before closing) */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const [data, setData] = useState<{ notes: VerseNote[]; tags: NoteTag[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  // a fresh form after each save, so nothing from the last one lingers
  const [formRound, setFormRound] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<{ id: string; msg: string } | null>(null);
  // only the newest load may update the list (an older, slower one is dropped)
  const loadSeq = useRef(0);
  const restoredDrafts = useRef(false);

  const fetchNotes = useCallback(async (): Promise<Awaited<ReturnType<typeof loadVerseNotesAction>>> => {
    try {
      return await loadVerseNotesAction(surah, ayah);
    } catch {
      return { error: "تعذّر تحميل الملاحظات — يُرجى التحقّق من الاتصال" };
    }
  }, [surah, ayah]);

  const apply = useCallback((seq: number, r: Awaited<ReturnType<typeof loadVerseNotesAction>>) => {
    if (seq !== loadSeq.current) return;
    if ("error" in r) {
      setLoadError(r.error);
      return;
    }
    setLoadError(null);
    setData(r);
    // an unsaved draft from before (closed, reloaded, failed): reopen its form
    if (!restoredDrafts.current) {
      restoredDrafts.current = true;
      // a new-note draft whose text is already a note here was saved even
      // though the page never heard back (a dropped connection): drop it,
      // or saving it again would make a duplicate
      const newKey = draftKey(surah, ayah, "new");
      const newDraft = readDraft(newKey);
      if (newDraft && r.notes.some((n) => n.text === newDraft.text.replace(/\r\n/g, "\n").trim())) clearDraft(newKey);
      const withDraft = readDraft(newKey) ? "new" : r.notes.find((n) => readDraft(draftKey(surah, ayah, n.id)))?.id;
      if (withDraft) setEditing(withDraft);
    }
  }, [surah, ayah]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    apply(seq, await fetchNotes());
  }, [apply, fetchNotes]);

  useEffect(() => {
    let alive = true;
    const seq = ++loadSeq.current;
    fetchNotes().then((r) => alive && apply(seq, r));
    return () => {
      alive = false;
    };
  }, [apply, fetchNotes]);

  if (!data) {
    return loadError ? (
      <div className={styles.err} role="alert">
        {loadError}{" "}
        <button type="button" className={styles.linkBtn} onClick={() => void load()}>
          إعادة المحاولة
        </button>
      </div>
    ) : (
      <div className={styles.counter}>جارٍ التحميل…</div>
    );
  }

  const tagById = new Map(data.tags.map((t) => [t.id, t]));
  const full = data.notes.length >= NOTE_LIMITS.perVerse;
  const formOpen = editing !== null;

  function saved(note: VerseNote | undefined, wasNew: boolean) {
    if (note) {
      setData((d) => d && { ...d, notes: wasNew ? [note, ...d.notes] : d.notes.map((n) => (n.id === note.id ? note : n)) });
    }
    setEditing(null);
    setFormRound((k) => k + 1);
    void load();
  }

  async function remove(id: string) {
    setDeleting(id);
    setNoteError(null);
    let r: { error?: string };
    try {
      r = await deleteNoteAction(id);
    } catch {
      r = { error: `تعذّر الحذف — ${p("تحقّق", "تحقّقي")} من اتصالك ثم ${p("حاول", "حاولي")} مجددًا` };
    }
    setDeleting(null);
    if (r.error) {
      setNoteError({ id, msg: r.error });
      return;
    }
    setConfirmDelete(null);
    clearDraft(draftKey(surah, ayah, id));
    setData((d) => d && { ...d, notes: d.notes.filter((n) => n.id !== id) });
    void load();
  }

  return (
    <div>
      {editing === "new" ? (
        <NoteForm
          key={`new-${formRound}`}
          g={g}
          tags={data.tags}
          initial={{ text: "", tagIds: [] }}
          draft={draftKey(surah, ayah, "new")}
          onDirtyChange={onDirtyChange}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            const r = await saveNoteAction({ surahNumber: surah, ayah, ...v });
            if (!r.error) saved(r.note, true);
            return r;
          }}
        />
      ) : (
        <div className={styles.formRow} style={{ marginTop: 0, marginBottom: 12 }}>
          <button type="button" className={styles.primaryBtn} disabled={full || formOpen} onClick={() => setEditing("new")}>
            + ملاحظة جديدة
          </button>
          {full && <span className={styles.counter}>وصلت ملاحظات هذه الآية إلى حدّها ({NOTE_LIMITS.perVerse}).</span>}
        </div>
      )}

      {loadError && (
        <div className={styles.err} role="alert" style={{ marginBottom: 10 }}>
          {loadError}{" "}
          <button type="button" className={styles.linkBtn} onClick={() => void load()}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {data.notes.length === 0 && editing !== "new" && (
        <div className={styles.counter} style={{ padding: "6px 2px 4px" }}>
          لا توجد ملاحظات على هذه الآية بعد — {p("يمكنك", "يمكنكِ")} تدوين متشابهاتها أو تدبّرك أو تفسيرها.
        </div>
      )}

      {data.notes.map((n) =>
        editing === n.id ? (
          <NoteForm
            key={`${n.id}-${formRound}`}
            g={g}
            tags={data.tags}
            initial={{ text: n.text, tagIds: n.tagIds }}
            draft={draftKey(surah, ayah, n.id)}
            onDirtyChange={onDirtyChange}
            onCancel={() => setEditing(null)}
            onSave={async (v) => {
              const r = await saveNoteAction({ id: n.id, surahNumber: surah, ayah, ...v });
              if (!r.error) saved(r.note, false);
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
              {/* one form at a time: another note's form would drop the open one */}
              {!formOpen &&
                (confirmDelete === n.id ? (
                  <>
                    <span>حذف هذه الملاحظة؟</span>
                    <button type="button" className={styles.dangerBtn} disabled={deleting === n.id} onClick={() => remove(n.id)}>
                      {deleting === n.id ? "جارٍ الحذف…" : "نعم، حذف"}
                    </button>
                    <button type="button" className={styles.linkBtn} disabled={deleting === n.id} onClick={() => setConfirmDelete(null)}>
                      تراجع
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        setNoteError(null);
                        setConfirmDelete(null);
                        setEditing(n.id);
                      }}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => {
                        setNoteError(null);
                        setConfirmDelete(n.id);
                      }}
                    >
                      حذف
                    </button>
                  </>
                ))}
            </div>
            {noteError?.id === n.id && (
              <div className={styles.err} role="alert">
                {noteError.msg}
              </div>
            )}
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
  draft,
  onSave,
  onCancel,
  onDirtyChange,
}: {
  g: GroupGender;
  tags: NoteTag[];
  initial: Draft;
  /** where her unsaved text is kept on this device */
  draft: string;
  onSave: (v: Draft) => Promise<{ error?: string }>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const known = (ids: string[]) => ids.filter((id) => tags.some((t) => t.id === id));
  // a draft from an earlier attempt wins over the saved text
  const [restored] = useState(() => {
    const d = readDraft(draft);
    return d && (d.text !== initial.text || !sameIds(known(d.tagIds), known(initial.tagIds))) ? d : null;
  });
  const [text, setText] = useState(restored?.text ?? initial.text);
  // tags deleted since stay out
  const [tagIds, setTagIds] = useState(known(restored?.tagIds ?? initial.tagIds));
  const [showRestored, setShowRestored] = useState(restored !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = text !== initial.text || !sameIds(tagIds, known(initial.tagIds));

  useEffect(() => {
    onDirtyChange?.(dirty);
    if (!dirty) return;
    // a reload or closing the tab asks first (the draft stays either way)
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function keep(next: Draft) {
    if (next.text !== initial.text || !sameIds(next.tagIds, known(initial.tagIds))) writeDraft(draft, next);
    else clearDraft(draft);
  }

  function toggle(id: string) {
    const next = tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id];
    setTagIds(next);
    keep({ text, tagIds: next });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    let r: { error?: string };
    try {
      r = await onSave({ text, tagIds });
    } catch {
      r = { error: `تعذّر الحفظ — ${p("تحقّق", "تحقّقي")} من اتصالك ثم ${p("حاول", "حاولي")} مجددًا. ما ${p("كتبتَه", "كتبتِه")} ما زال هنا.` };
    }
    setSaving(false);
    if (r.error) setError(r.error);
    else clearDraft(draft);
  }

  function discard() {
    clearDraft(draft);
    onCancel();
  }

  return (
    <div className={styles.form}>
      {showRestored && (
        <div className={styles.counter} style={{ marginBottom: 8 }}>
          📝 {p("استعدنا ما كتبتَه ولم يُحفظ بعد.", "استعدنا ما كتبتِه ولم يُحفظ بعد.")}{" "}
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setText(initial.text);
              setTagIds(known(initial.tagIds));
              clearDraft(draft);
              setShowRestored(false);
            }}
          >
            تجاهل المسودة
          </button>
        </div>
      )}
      <textarea
        className={styles.textarea}
        value={text}
        maxLength={NOTE_LIMITS.textMax}
        placeholder={p("اكتب ملاحظتك…", "اكتبي ملاحظتك…")}
        aria-label="نصّ الملاحظة"
        autoFocus
        onChange={(e) => {
          setText(e.target.value);
          keep({ text: e.target.value, tagIds });
        }}
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
                disabled={saving || (!on && tagIds.length >= NOTE_LIMITS.tagsPerNote)}
                onClick={() => toggle(t.id)}
              />
            );
          })}
        </div>
      )}
      {error && (
        <div className={styles.err} role="alert">
          {error}
        </div>
      )}
      {confirmDiscard ? (
        <div className={styles.formRow}>
          <span className={styles.counter}>{p("تجاهل ما كتبتَه؟", "تجاهل ما كتبتِه؟")}</span>
          <button type="button" className={styles.dangerBtn} onClick={discard}>
            نعم، تجاهل
          </button>
          <button type="button" className={styles.linkBtn} onClick={() => setConfirmDiscard(false)}>
            متابعة الكتابة
          </button>
        </div>
      ) : (
        <div className={styles.formRow}>
          <button type="button" className={styles.primaryBtn} disabled={saving || !text.trim()} onClick={save}>
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button type="button" className={styles.ghostBtn} disabled={saving} onClick={() => (dirty ? setConfirmDiscard(true) : discard())}>
            إلغاء
          </button>
        </div>
      )}
    </div>
  );
}
