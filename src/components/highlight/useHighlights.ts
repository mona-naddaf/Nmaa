"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackSave } from "@/components/leave-guard/LeaveGuard";
import {
  addHighlightColorAction,
  createHighlightAction,
  loadHighlightsAction,
  recolorHighlightAction,
  removeHighlightAction,
  removeHighlightColorAction,
  renameHighlightColorAction,
  restoreHighlightAction,
  restoreHighlightColorAction,
} from "@/app/rafiq/(app)/highlight-actions";
import { getAyahPageEntries } from "@/lib/quran-data";
import { splitAyah } from "@/lib/quran-data/words";
import { DEFAULT_HIGHLIGHT_COLOR, HIGHLIGHT_COLORS, type HighlightColor } from "@/lib/highlight/colors";
import { canChange, canHighlight, covers, rangeOf, rangeProblem, snapToGlyphs, type HighlightRow, type HighlightViewer, type PaletteEntry, type RangeProblem, type WordRef } from "@/lib/highlight/rules";
import { colorName, highlightTexts } from "@/lib/highlight/texts";

// «التظليل» in the browser, for one display of one surah's ayat: her
// highlights and colours (loaded through the page's own actions), highlight
// mode, the first tapped word, the menu of a highlight, and the undo toast.
// Every change shows at once and is saved quietly; a refused save is put
// back with a short message (trackSave keeps the leave-page guard aware).

export type HighlightConfig = {
  // whoever is looking, for the texts
  gender: "MALE" | "FEMALE" | null;
  // a child's id on an adult's view of the child's page
  subjectId?: string;
};

/** How a word (or an ayah-end glyph) is drawn: in which highlight, and whether it opens / closes it. */
export type Band = { id: string; color: HighlightColor; start: boolean; end: boolean };

type Toast = { id: number; text: string; undo?: () => void };

let tempIds = 0;
let toastIds = 0;
const TOAST_MS = 10_000;

export function useHighlights(cfg: HighlightConfig | undefined, surah: number, wordCount: (ayah: number) => number) {
  const t = highlightTexts(cfg?.gender ?? null);
  const [data, setData] = useState<{ surah: number; viewer: HighlightViewer; rows: HighlightRow[]; palette: PaletteEntry[] } | null>(null);
  const [mode, setMode] = useState(false);
  const [pending, setPending] = useState<WordRef | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [current, setCurrent] = useState<HighlightColor>(DEFAULT_HIGHLIGHT_COLOR);
  const [menu, setMenu] = useState<{ id: string; key: string } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const subjectId = cfg?.subjectId;

  const enabled = !!cfg;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadHighlightsAction(surah, subjectId).then(
      (r) => alive && r.ok && setData({ surah, viewer: r.viewer, rows: r.highlights, palette: r.palette }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [enabled, surah, subjectId]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const ready = data && data.surah === surah ? data : null;
  const rows = ready?.rows ?? [];
  const palette = ready?.palette ?? [{ color: DEFAULT_HIGHLIGHT_COLOR, name: null }];
  const viewer = ready?.viewer ?? "adult-view";
  const color = palette.some((p) => p.color === current) ? current : DEFAULT_HIGHLIGHT_COLOR;

  const setRows = useCallback((fn: (rows: HighlightRow[]) => HighlightRow[]) => setData((d) => (d ? { ...d, rows: fn(d.rows) } : d)), []);
  const setPalette = useCallback((fn: (p: PaletteEntry[]) => PaletteEntry[]) => setData((d) => (d ? { ...d, palette: fn(d.palette) } : d)), []);

  /** The toast: a new one replaces the current one (whose action then stays final). */
  const showToast = useCallback((text: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    const id = ++toastIds;
    setToast({ id, text, undo });
    toastTimer.current = setTimeout(() => setToast((x) => (x?.id === id ? null : x)), TOAST_MS);
  }, []);

  const facts = {
    wordCount: (s: number, a: number) => (s === surah ? wordCount(a) : 0),
    pageOf: (s: number, a: number) => getAyahPageEntries(s)?.[a - 1]?.[1] ?? null,
  };

  /** The highlight a word is in, as drawn. */
  const bandOf = (ayah: number, word: number): Band | null => {
    const h = rows.find((r) => covers(r, surah, ayah, word));
    if (!h) return null;
    return { id: h.id, color: h.color, start: h.fromAyah === ayah && h.fromWord === word, end: h.toAyah === ayah && h.toWord === word };
  };
  /** An ayah-end glyph (its number) inside a highlight that runs on into the next ayah. */
  const bandAtEnd = (ayah: number): Band | null => {
    const last = bandOf(ayah, wordCount(ayah));
    const next = bandOf(ayah + 1, 1);
    return last && next && last.id === next.id ? { ...last, start: false, end: false } : null;
  };

  function exitMode() {
    setMode(false);
    setPending(null);
    setMenu(null);
    setMessage(null);
  }

  /** A word tapped in highlight mode (inRange: a word of the ayat shown). */
  function tap(ayah: number, word: number, key: string, inRange = true) {
    setMessage(null);
    if (!inRange) return setMessage(t.outside);
    if (!pending) {
      const inside = rows.find((r) => covers(r, surah, ayah, word));
      if (inside) return setMenu(menu?.id === inside.id ? null : { id: inside.id, key });
      setMenu(null);
      return setPending({ ayah, word });
    }
    const range = snapToGlyphs(rangeOf(surah, pending, { ayah, word }));
    const problem = rangeProblem(range, facts, rows);
    if (problem) return setMessage(t.problem[problem]);
    setPending(null);
    const temp = `temp-${++tempIds}`;
    const row: HighlightRow = { id: temp, ...range, color, byAdult: viewer === "adult-edit", byName: null };
    setRows((rs) => [...rs, row]);
    trackSave(createHighlightAction({ range, color, subjectId })).then(
      (r) => {
        if ("ok" in r) setRows((rs) => rs.map((x) => (x.id === temp ? r.highlight : x)));
        else {
          setRows((rs) => rs.filter((x) => x.id !== temp));
          const p = (r as { problem?: RangeProblem }).problem;
          setMessage(p ? t.problem[p] : t.saveFailed);
        }
      },
      () => {
        setRows((rs) => rs.filter((x) => x.id !== temp));
        setMessage(t.saveFailed);
      },
    );
  }

  function remove(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || id.startsWith("temp-")) return;
    setMenu(null);
    setRows((rs) => rs.filter((x) => x.id !== id));
    const putBack = () => setRows((rs) => (rs.some((x) => x.id === id) ? rs : [...rs, row]));
    trackSave(removeHighlightAction(id, subjectId)).then(
      (r) => {
        if (!("ok" in r)) {
          putBack();
          return setMessage(t.removeFailed);
        }
        showToast(t.removed, () => {
          putBack();
          setToast(null);
          trackSave(restoreHighlightAction(id, subjectId)).then(
            (u) => {
              if (!("ok" in u)) {
                setRows((rs) => rs.filter((x) => x.id !== id));
                const p = (u as { problem?: RangeProblem }).problem;
                setMessage(p ? t.problem[p] : t.saveFailed);
              }
            },
            () => {
              setRows((rs) => rs.filter((x) => x.id !== id));
              setMessage(t.saveFailed);
            },
          );
        });
      },
      () => {
        putBack();
        setMessage(t.removeFailed);
      },
    );
  }

  function recolor(id: string, to: HighlightColor) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.color === to || id.startsWith("temp-")) return;
    setMenu(null);
    setRows((rs) => rs.map((x) => (x.id === id ? { ...x, color: to } : x)));
    const back = () => {
      setRows((rs) => rs.map((x) => (x.id === id ? { ...x, color: row.color } : x)));
      setMessage(t.colorFailed);
    };
    trackSave(recolorHighlightAction(id, to, subjectId)).then((r) => !("ok" in r) && back(), back);
  }

  // ---- colours ----

  function addColor(c: HighlightColor) {
    if (palette.some((p) => p.color === c)) return setCurrent(c);
    setPalette((p) => [...p, { color: c, name: null }]);
    setCurrent(c);
    const back = () => {
      setPalette((p) => p.filter((x) => x.color !== c));
      setMessage(t.colorFailed);
    };
    trackSave(addHighlightColorAction(c, subjectId)).then((r) => !("ok" in r) && back(), back);
  }

  /** Saves a colour's name; resolves false when refused (the field shows it). */
  function renameColor(c: HighlightColor, name: string): Promise<boolean> {
    const before = palette.find((p) => p.color === c)?.name ?? null;
    const clean = name.replace(/\s+/g, " ").trim() || null;
    if (clean === before) return Promise.resolve(true);
    setPalette((p) => p.map((x) => (x.color === c ? { ...x, name: clean } : x)));
    return trackSave(renameHighlightColorAction(c, name, subjectId)).then(
      (r) => {
        if ("ok" in r) return true;
        setPalette((p) => p.map((x) => (x.color === c ? { ...x, name: before } : x)));
        return false;
      },
      () => {
        setPalette((p) => p.map((x) => (x.color === c ? { ...x, name: before } : x)));
        return false;
      },
    );
  }

  function removeColor(c: HighlightColor) {
    if (c === DEFAULT_HIGHLIGHT_COLOR) return;
    const index = palette.findIndex((p) => p.color === c);
    const entry = palette[index];
    if (!entry) return;
    const movedIds = rows.filter((r) => r.color === c).map((r) => r.id);
    setPalette((p) => p.filter((x) => x.color !== c));
    setRows((rs) => rs.map((x) => (x.color === c ? { ...x, color: DEFAULT_HIGHLIGHT_COLOR } : x)));
    if (current === c) setCurrent(DEFAULT_HIGHLIGHT_COLOR);
    const back = () => {
      setPalette((p) => (p.some((x) => x.color === c) ? p : [...p.slice(0, index), entry, ...p.slice(index)]));
      setRows((rs) => rs.map((x) => (movedIds.includes(x.id) ? { ...x, color: c } : x)));
    };
    trackSave(removeHighlightColorAction(c, subjectId)).then(
      (r) => {
        if (!("ok" in r)) {
          back();
          return setMessage(t.colorFailed);
        }
        showToast(t.colorRemoved(colorName(palette[0])), () => {
          back();
          setToast(null);
          trackSave(restoreHighlightColorAction(r.undo, subjectId)).then(
            (u) => !("ok" in u) && setMessage(t.colorFailed),
            () => setMessage(t.colorFailed),
          );
        });
      },
      () => {
        back();
        setMessage(t.colorFailed);
      },
    );
  }

  const on = !!cfg && !!ready;
  return {
    on,
    t,
    gender: cfg?.gender ?? null,
    viewer,
    canHighlight: on && canHighlight(viewer),
    mode: on && mode,
    toggleMode: () => (mode ? exitMode() : (setMode(true), setMessage(null))),
    pending,
    message,
    clearMessage: () => setMessage(null),
    color,
    setColor: setCurrent,
    palette,
    rows,
    bandOf: on ? bandOf : () => null,
    bandAtEnd: on ? bandAtEnd : () => null,
    tap,
    menu: menu && rows.find((r) => r.id === menu.id) ? { ...menu, row: rows.find((r) => r.id === menu.id)!, changeable: canChange(viewer, rows.find((r) => r.id === menu.id)!) } : null,
    closeMenu: () => setMenu(null),
    remove,
    recolor,
    addColor,
    renameColor,
    removeColor,
    toast,
    closeToast: () => setToast(null),
    swatch: (c: HighlightColor) => HIGHLIGHT_COLORS[c],
  };
}

export type Highlights = ReturnType<typeof useHighlights>;

/** What MushafPages needs from a display's highlights: bands by glyph key, and the mode's taps (unset: off). */
export function pageHighlight(hl: Highlights, surah: number, text: string[] | null) {
  if (!hl.on) return {};
  const bandOf = (key: string) => {
    const [s, a, w] = key.split(":");
    if (Number(s) !== surah) return null;
    return w === "e" ? hl.bandAtEnd(Number(a)) : hl.bandOf(Number(a), Number(w));
  };
  const label = (key: string) => {
    const [, a, w] = key.split(":").map(Number);
    return (text && splitAyah(surah, a, text[a - 1] ?? "").words[w - 1]?.text) || "";
  };
  return {
    bandOf,
    highlightMode: hl.mode
      ? {
          tap: (key: string, inRange: boolean) => {
            const [, a, w] = key.split(":").map(Number);
            hl.tap(a, w, key, inRange);
          },
          pendingKey: hl.pending ? `${surah}:${hl.pending.ayah}:${hl.pending.word}` : null,
          label,
        }
      : undefined,
  };
}

/** An ayah's word count from the surah's text (0 while it isn't loaded). */
export const wordCounter = (surah: number, text: string[] | null) => (ayah: number) => (text?.[ayah - 1] ? splitAyah(surah, ayah, text[ayah - 1]).words.length : 0);
