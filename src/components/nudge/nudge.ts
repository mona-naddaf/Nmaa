"use client";

import styles from "./nudge.module.css";

// «رفيق الحفظ» and «العائلة»: a button never looks dead. When pressing it can't
// do anything yet, it points her to the reason instead: the message or field is
// scrolled into view, focused when it takes focus, and flashed for a moment.

const FLASH_MS = 1200;

/** Scrolls to the element, focuses it (fields, or anything with tabIndex), and flashes it. */
export function pointTo(el: HTMLElement | null | undefined, { focus = true }: { focus?: boolean } = {}) {
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  if (focus) el.focus({ preventScroll: true });
  flash(el);
}

/** Highlights the element briefly (an outline instead of the fade with reduced motion). */
export function flash(el: HTMLElement) {
  el.classList.remove(styles.flash);
  // restart the animation when it is still running from a previous press
  void el.offsetWidth;
  el.classList.add(styles.flash);
  window.setTimeout(() => el.classList.remove(styles.flash), FLASH_MS);
}

/**
 * Props for the one kind of button that may stay inactive: undo at zero and
 * the ▲▼ / period arrows at the ends of a list. It stays visible and focusable
 * with a tooltip saying why, looks lighter, and has no press effect; the click
 * does nothing.
 */
export function inertProps(inert: boolean, why: string) {
  return inert ? { "aria-disabled": true as const, title: why, "data-inert": "" } : {};
}

export const inertClass = styles.inert;
