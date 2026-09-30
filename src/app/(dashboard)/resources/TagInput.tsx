"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./bank.module.css";
import { suggestTagsAction } from "./actions";
import { resourcesCount } from "@/lib/resources/normalize";

type Suggestion = { name: string; key: string; count: number };

// Suggests existing tags from the bank while typing, so people reuse
// «المولد النبوي» instead of creating «المولد». Matching on the server
// ignores diacritics, tatweel, hamza forms and ة/ه.
function useTagSuggestions(text: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const latest = useRef(0);
  useEffect(() => {
    const call = ++latest.current;
    if (!text.trim()) return;
    const timer = setTimeout(async () => {
      const result = await suggestTagsAction(text);
      if (call === latest.current) setSuggestions(result);
    }, 200);
    return () => clearTimeout(timer);
  }, [text]);
  return text.trim() ? suggestions : [];
}

function SuggestionList({ items, onPick }: { items: Suggestion[]; onPick: (name: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.suggestions} role="listbox">
      {items.map((s) => (
        <button
          key={s.key}
          type="button"
          role="option"
          aria-selected={false}
          className={styles.suggestion}
          // mousedown, so the pick lands before the input's blur hides the list
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(s.name);
          }}
        >
          <span>{s.name}</span>
          <small>{resourcesCount(s.count)}</small>
        </button>
      ))}
    </div>
  );
}

/** Several tags, for the add/edit form. */
export function TagsInput({ value, onChange, max }: { value: string[]; onChange: (tags: string[]) => void; max: number }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const suggestions = useTagSuggestions(text).filter((s) => !value.includes(s.name));

  function add(name: string) {
    const clean = name.replace(/\s+/g, " ").trim();
    if (clean && !value.includes(clean) && value.length < max) onChange([...value, clean]);
    setText("");
  }

  return (
    <div className={styles.field}>
      <div className={styles.tagBox}>
        {value.map((t) => (
          <span key={t} className={styles.chosenTag}>
            {t}
            <button type="button" aria-label={`إزالة الوسم ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            value={text}
            placeholder={value.length ? "وسم آخر…" : "مثال: ترحيب، الجنة والنار"}
            onChange={(e) => {
              const v = e.target.value;
              // a comma (Arabic or Latin) ends a tag
              if (/[،,]/.test(v)) v.split(/[،,]/).slice(0, -1).forEach(add);
              setText(v.split(/[،,]/).pop() ?? "");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
              } else if (e.key === "Backspace" && !text && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              if (text.trim()) add(text);
            }}
            aria-label="الوسوم"
          />
        )}
      </div>
      {focused && <SuggestionList items={suggestions} onPick={add} />}
    </div>
  );
}

/** One tag, for filtering the bank. */
export function TagFilterInput({ value, onCommit }: { value: string; onCommit: (tag: string) => void }) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const suggestions = useTagSuggestions(focused ? text : "");

  return (
    <div className={styles.field} style={{ marginBottom: 0 }}>
      <input
        className={styles.input}
        value={text}
        placeholder="تصفية حسب الوسم"
        aria-label="تصفية حسب الوسم"
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (text.trim() !== value) onCommit(text.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {focused && (
        <SuggestionList
          items={suggestions}
          onPick={(name) => {
            setText(name);
            setFocused(false);
            onCommit(name);
          }}
        />
      )}
    </div>
  );
}
