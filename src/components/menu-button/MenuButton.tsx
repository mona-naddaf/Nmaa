"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./menu-button.module.css";

export interface MenuItem {
  href: string;
  label: string;
}

/**
 * A button that opens a small menu of links. With one item it is just a link
 * to it (labelled with that item), with none it renders nothing — callers
 * pass only the items the viewer may use (the pages behind them check again).
 *
 * Keyboard: Enter/Space/↓ open and focus the first item (↑: the last),
 * ↑/↓/Home/End move, Esc closes and returns focus to the button. Focus
 * leaving it (Tab) or a click or tap outside closes it.
 */
export function MenuButton({
  label,
  items,
  className,
  primary = false,
}: {
  label: string;
  items: MenuItem[];
  // trigger styling, shared with the page's other buttons
  className: string;
  // the main action (filled) vs a secondary one
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // item to focus once the menu has rendered (opened from the keyboard)
  const pendingFocus = useRef<number | null>(null);
  // a press inside (button or item) is in progress: Safari doesn't focus
  // what's pressed, so its blur mustn't close the menu before the click lands
  const pressingInside = useRef(false);
  const menuId = useId();

  // keep the menu on screen on narrow phones: it opens under its button and
  // shifts sideways just enough to stay 8px inside the viewport
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!open || !el) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let shift = 0;
    if (r.right > vw - 8) shift = vw - 8 - r.right;
    if (r.left + shift < 8) shift = 8 - r.left;
    if (shift) el.style.transform = `translateX(${shift}px)`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (pendingFocus.current !== null) {
      itemRefs.current[pendingFocus.current]?.focus();
      pendingFocus.current = null;
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Esc anywhere, also when focus isn't inside (opened by mouse on a
    // browser that doesn't focus the pressed button)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;
  if (items.length === 1) {
    return (
      <Link href={items[0].href} className={className}>
        {items[0].label}
      </Link>
    );
  }

  const focusItem = (i: number) => itemRefs.current[(i + items.length) % items.length]?.focus();

  function openMenu(focusIndex: number) {
    if (open) return focusItem(focusIndex);
    // focused by the effect above, once the items exist
    pendingFocus.current = (focusIndex + items.length) % items.length;
    setOpen(true);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(items.length - 1);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(items.length - 1);
    }
  }

  return (
    <div
      className={styles.root}
      ref={rootRef}
      onPointerDown={() => {
        pressingInside.current = true;
        window.addEventListener("pointerup", () => setTimeout(() => (pressingInside.current = false)), { once: true });
      }}
      // focus leaving the button and its menu (Tab, Shift+Tab, …) closes it
      onBlur={(e) => {
        if (pressingInside.current) return;
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={onTriggerKeyDown}
      >
        {label}
        <span className={`${styles.caret} ${primary ? styles.caretLight : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={menuId} ref={menuRef} role="menu" aria-label={label} className={styles.menu} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              tabIndex={-1}
              className={styles.item}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
