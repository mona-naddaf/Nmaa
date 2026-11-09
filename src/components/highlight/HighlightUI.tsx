"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./highlight.module.css";
import { LeaveGuard } from "@/components/leave-guard/LeaveGuard";
import { useGuideTarget } from "@/components/guide/targets";
import { HIGHLIGHT_COLOR_KEYS, HIGHLIGHT_COLORS, DEFAULT_HIGHLIGHT_COLOR, type HighlightColor } from "@/lib/highlight/colors";
import { covers, MAX_COLOR_NAME, MAX_HIGHLIGHT_COLORS, type HighlightRow } from "@/lib/highlight/rules";
import { colorName } from "@/lib/highlight/texts";
import { splitAyah } from "@/lib/quran-data/words";
import type { Band, Highlights } from "./useHighlights";

// «التظليل»'s pieces: the bar above the verses (button, colour chip, hint,
// colour panel), a highlight's menu, the undo toast, and the band styling
// that every view uses to draw a word inside a highlight.

/** The class and style that put a word (or the space after it, banded = not its end) inside a highlight. */
export function bandProps(band: Band | null, part: "word" | "space" = "word"): { className: string; style?: CSSProperties } {
  if (!band || (part === "space" && band.end)) return { className: "" };
  const cls = [styles.band, part === "word" && band.start ? styles.bandStart : "", part === "word" && band.end ? styles.bandEnd : ""].filter(Boolean).join(" ");
  return { className: cls, style: { ["--hl" as string]: HIGHLIGHT_COLORS[band.color].band } };
}

const toArabicDigits = (n: number) => String(n).replace(/d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

export const modeWordClass = styles.modeWord;
export const pendingWordClass = styles.pendingWord;

/** The bar above the verses: «تظليل», and in highlight mode the colour chip, the hint and the panel. */
export function HighlightBar({ hl }: { hl: Highlights }) {
  const [panel, setPanel] = useState(false);
  const g = useGuideTarget();
  if (!hl.on) return null;
  const { t } = hl;
  const current = hl.palette.find((p) => p.color === hl.color) ?? hl.palette[0];
  return (
    <div className={styles.bar}>
      {hl.canHighlight && (
        <button
          type="button"
          className={styles.btn}
          aria-pressed={hl.mode}
          aria-label={hl.mode ? t.buttonOn : t.buttonAria}
          {...g("highlight.button")}
          onClick={() => {
            setPanel(false);
            hl.toggleMode();
          }}
        >
          {hl.mode ? t.buttonOn : t.button}
        </button>
      )}
      {hl.mode && (
        <button type="button" className={styles.chip} aria-expanded={panel} aria-label={t.chipAria(colorName(current))} onClick={() => setPanel(!panel)} {...g("highlight.chip")}>
          <span className={styles.dot} style={{ background: HIGHLIGHT_COLORS[current.color].swatch }} aria-hidden />
          <span className={styles.chipName}>{colorName(current)}</span>
          <span aria-hidden>▾</span>
        </button>
      )}
      {hl.mode && panel && <ColorPanel hl={hl} onPicked={() => setPanel(false)} />}
      {hl.mode && !panel && (
        <div className={styles.hint} role="status">
          {hl.pending ? t.hintLast : t.hintFirst}
        </div>
      )}
      {hl.message && (
        <div className={styles.message} role="alert">
          {hl.message}
        </div>
      )}
      <HighlightMenu hl={hl} />
      <HighlightToast hl={hl} />
      <LeaveGuard you={hl.gender} />
    </div>
  );
}

/** Her colours: one tap switches; a name for each; a new one from the palette; removing one (never the default). */
function ColorPanel({ hl, onPicked }: { hl: Highlights; onPicked: () => void }) {
  const { t } = hl;
  const [adding, setAdding] = useState(false);
  const unused = HIGHLIGHT_COLOR_KEYS.filter((c) => !hl.palette.some((p) => p.color === c));
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{t.panelTitle}</div>
      <div role="radiogroup" aria-label={t.panelTitle}>
        {hl.palette.map((p) => (
          <div key={p.color} className={styles.colorRow}>
            <button
              type="button"
              role="radio"
              aria-checked={hl.color === p.color}
              aria-label={colorName(p)}
              className={styles.pickBtn}
              onClick={() => {
                hl.setColor(p.color);
                onPicked();
              }}
            >
              <span className={styles.dot} style={{ background: HIGHLIGHT_COLORS[p.color].swatch }} />
            </button>
            <NameField hl={hl} color={p.color} name={p.name} />
            {p.color !== DEFAULT_HIGHLIGHT_COLOR ? (
              <button type="button" className={styles.small} aria-label={t.removeColorAria(colorName(p))} onClick={() => hl.removeColor(p.color)}>
                {t.removeColor}
              </button>
            ) : (
              <span className={styles.note}>{t.defaultNote}</span>
            )}
          </div>
        ))}
      </div>
      {hl.palette.length < MAX_HIGHLIGHT_COLORS && unused.length > 0 ? (
        adding ? (
          <div>
            <div className={styles.note}>{t.pickNew}</div>
            <div className={styles.swatches}>
              {unused.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.pickBtn}
                  aria-label={HIGHLIGHT_COLORS[c].label}
                  onClick={() => {
                    hl.addColor(c);
                    setAdding(false);
                  }}
                >
                  <span className={styles.dot} style={{ background: HIGHLIGHT_COLORS[c].swatch }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button type="button" className={styles.small} onClick={() => setAdding(true)}>
            {t.addColor}
          </button>
        )
      ) : (
        <div className={styles.note}>{t.maxColors}</div>
      )}
    </div>
  );
}

/** A colour's name: saved on blur or Enter (auto-save); too long stays here with a note. */
function NameField({ hl, color, name }: { hl: Highlights; color: HighlightColor; name: string | null }) {
  const [value, setValue] = useState(name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(name);
  if (shown !== name) {
    setShown(name);
    setValue(name ?? "");
  }
  const save = () => {
    if (value.trim().length > MAX_COLOR_NAME) return setError(hl.t.nameTooLong);
    setError(null);
    hl.renameColor(color, value).then((ok) => !ok && setError(hl.t.colorFailed));
  };
  return (
    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <input
        className={styles.nameField}
        value={value}
        maxLength={MAX_COLOR_NAME + 10}
        placeholder={hl.t.namePlaceholder}
        aria-label={hl.t.nameAria(HIGHLIGHT_COLORS[color].label)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
      {error && <span className={styles.fieldError}>{error}</span>}
    </span>
  );
}

/** The menu of the highlight a word was tapped in (highlight mode), placed under that word. */
function HighlightMenu({ hl }: { hl: Highlights }) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const menu = hl.menu;
  const key = menu?.key ?? null;
  useLayoutEffect(() => {
    if (!key) return;
    const el = document.querySelector(`[data-hl-key="${key}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(260, document.documentElement.clientWidth - 24);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 12);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- placed once from the word's position
    setPlace({ top: r.bottom + 6, left });
  }, [key]);
  const close = hl.closeMenu;
  useEffect(() => {
    if (!key) return;
    const down = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!box.current?.contains(target) && !target.closest?.("[data-hl-key]")) close();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    const away = () => close();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", away, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", away);
    };
  }, [key, close]);
  if (!menu || !place) return null;
  const { t } = hl;
  const entry = hl.palette.find((p) => p.color === menu.row.color) ?? { color: menu.row.color, name: null };
  return createPortal(
    <div ref={box} className={styles.menu} style={{ top: place.top, left: place.left }} role="menu" dir="rtl">
      <div className={styles.menuHead}>
        <span className={styles.dot} style={{ background: HIGHLIGHT_COLORS[menu.row.color].swatch }} aria-hidden />
        {entry.name ?? HIGHLIGHT_COLORS[menu.row.color].label}
      </div>
      {!menu.changeable ? (
        <>
          <div className={styles.menuHead}>{t.lockedBy(menu.row.byName)}</div>
          <div className={styles.note} style={{ padding: "0 4px 4px" }}>
            {t.lockedNote}
          </div>
        </>
      ) : (
        <>
          {hl.palette.length > 1 && (
            <>
              <div className={styles.note} style={{ padding: "2px 4px" }}>
                {t.menuChangeColor}
              </div>
              <div className={styles.swatches}>
                {hl.palette.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    role="menuitemradio"
                    aria-checked={p.color === menu.row.color}
                    aria-label={colorName(p)}
                    className={styles.pickBtn}
                    onClick={() => hl.recolor(menu.id, p.color)}
                  >
                    <span className={styles.dot} style={{ background: HIGHLIGHT_COLORS[p.color].swatch }} />
                  </button>
                ))}
              </div>
            </>
          )}
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => hl.remove(menu.id)}>
            {t.menuRemove}
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

/** «تراجع» for 10 seconds after a removal; a new toast replaces it. */
function HighlightToast({ hl }: { hl: Highlights }) {
  const toast = hl.toast;
  if (!toast || typeof document === "undefined") return null;
  return createPortal(
    <div className={styles.toast} role="status" dir="rtl">
      <span className={styles.toastText}>{toast.text}</span>
      {toast.undo && (
        <button type="button" className={styles.toastUndo} onClick={toast.undo}>
          {hl.t.undo}
        </button>
      )}
    </div>,
    document.body,
  );
}

/**
 * Highlight mode in «نص كبير»: the ayat word by word as plain buttons (no
 * mistake menus), with their bands. A word's tap starts or ends a stretch,
 * or opens the menu of the highlight it's in.
 */
export function HighlightModeText({
  hl,
  surah,
  fromAyah,
  toAyah,
  text,
  className,
  numbers = true,
  inline = false,
}: {
  hl: Highlights;
  surah: number;
  fromAyah: number;
  toAyah: number;
  text: string[];
  className?: string;
  // the ayah numbers ﴿n﴾ (off: the caller shows them)
  numbers?: boolean;
  // inside the caller's own text line
  inline?: boolean;
}) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={className} dir="rtl" lang="ar">
      {Array.from({ length: toAyah - fromAyah + 1 }, (_, i) => fromAyah + i).map((a) => {
        const split = splitAyah(surah, a, text[a - 1] ?? "");
        const endBand = hl.bandAtEnd(a);
        return (
          <Fragment key={a}>
            {split.words.map((w) => {
              const band = hl.bandOf(a, w.position);
              const key = `${surah}:${a}:${w.position}`;
              const pending = hl.pending?.ayah === a && hl.pending.word === w.position;
              const wp = bandProps(band);
              const sp = bandProps(band, "space");
              return (
                <Fragment key={w.position}>
                  <button
                    type="button"
                    data-hl-key={key}
                    className={`${styles.modeWord} ${wp.className} ${pending ? styles.pendingWord : ""}`}
                    style={wp.style}
                    onClick={() => hl.tap(a, w.position, key)}
                  >
                    {w.text}
                    {w.marks ? ` ${w.marks}` : ""}
                  </button>
                  <span className={sp.className} style={sp.style}>
                    {" "}
                  </span>
                </Fragment>
              );
            })}
            {numbers && (
              <>
                <span className={bandProps(endBand).className} style={bandProps(endBand).style}>
                  ﴿{toArabicDigits(a)}﴾
                </span>
                <span className={bandProps(endBand, "space").className} style={bandProps(endBand, "space").style}>
                  {" "}
                </span>
              </>
            )}
          </Fragment>
        );
      })}
    </Tag>
  );
}

/**
 * Display only (the segment preview's text, the practice rows, the verse
 * page): an ayah's words with her bands. Without highlights in the ayah, the
 * caller's plain text is used instead (null).
 */
export function BandedAyah({ hl, surah, ayah, text }: { hl: Pick<Highlights, "bandOf">; surah: number; ayah: number; text: string }): ReactNode {
  const split = splitAyah(surah, ayah, text);
  if (!split.words.some((w) => hl.bandOf(ayah, w.position))) return null;
  return (
    <>
      {split.basmala && `${split.basmala} `}
      {split.leadingMarks && `${split.leadingMarks} `}
      {split.words.map((w, i) => {
        const band = hl.bandOf(ayah, w.position);
        const wp = bandProps(band);
        const sp = bandProps(band, "space");
        return (
          <Fragment key={w.position}>
            <span className={wp.className} style={wp.style}>
              {w.text}
              {w.marks ? ` ${w.marks}` : ""}
            </span>
            {i < split.words.length - 1 && (
              <span className={sp.className} style={sp.style}>
                {" "}
              </span>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/** The verse page (display only): an ayah with her bands, from rows the server loaded; plain text without any. */
export function BandedVerse({ surah, ayah, text, rows }: { surah: number; ayah: number; text: string; rows: HighlightRow[] }) {
  const bandOf = (a: number, w: number): Band | null => {
    const h = rows.find((r) => covers(r, surah, a, w));
    return h ? { id: h.id, color: h.color, start: h.fromAyah === a && h.fromWord === w, end: h.toAyah === a && h.toWord === w } : null;
  };
  return BandedAyah({ hl: { bandOf }, surah, ayah, text }) || text;
}
