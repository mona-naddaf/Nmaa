"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./motion.module.css";
import { pickByGroup, type GroupGender } from "@/lib/text/gender";

// The day-complete celebration on «جدول المتابعة»: when her own tick makes
// today complete (isComplete(dayScore), as everywhere), leaves fall softly
// inside the day area and a short message shows. At most once a day per
// person: remembered in this browser (cosmetic, so localStorage is enough).
// «Today» is the caller's: the course's day for a student, her own day in
// «رفيق الحفظ». Only the tick handlers of the student and «رفيق الحفظ» pages
// call it, so staff and parents never see it.

const PREFIX = "namaa:celebrated:";
const LEAVES = 22;
const COLORS = ["var(--rose-deep)", "var(--rose)", "var(--gold-deep)", "var(--gold)"];
const LEAF_PATH = "M8 1C13 4.5 13.6 10.2 8 15 2.4 10.2 3 4.5 8 1Z M8 3.5V13.5";
const MESSAGE_MS = 3500;
const LEAVE_MS = 200;

/** Claims today's celebration for this person: false if it already happened today. */
function claim(key: string, today: string): boolean {
  try {
    const mine = `${PREFIX}${key}:`;
    const full = mine + today;
    if (localStorage.getItem(full)) return false;
    // forget earlier days
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(mine) && k !== full) localStorage.removeItem(k);
    }
    localStorage.setItem(full, "1");
  } catch {
    // no storage (private window, blocked): celebrate anyway
  }
  return true;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function dropLeaves(stage: HTMLElement) {
  const height = stage.clientHeight;
  const width = stage.clientWidth;
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  for (let i = 0; i < LEAVES; i++) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("class", styles.leaf);
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", LEAF_PATH);
    const color = COLORS[i % COLORS.length];
    path.style.fill = color;
    path.style.stroke = "rgba(255,255,255,0.55)";
    path.style.strokeWidth = "0.8";
    svg.appendChild(path);
    const size = rand(11, 18);
    svg.style.width = `${size}px`;
    svg.style.height = `${size}px`;
    svg.style.left = `${rand(0, Math.max(0, width - size))}px`;
    stage.appendChild(svg);

    // a soft fall: sways sideways, turns, fades out near the bottom
    const sway = rand(14, 34) * (Math.random() < 0.5 ? -1 : 1);
    const r0 = rand(-40, 40);
    const turn = rand(120, 300) * (Math.random() < 0.5 ? -1 : 1);
    const fall = height + 24;
    const at = (p: number, x: number) => `translate(${x}px, ${-20 + fall * p}px) rotate(${r0 + turn * p}deg)`;
    const anim = svg.animate(
      [
        { transform: at(0, 0), opacity: 0 },
        { transform: at(0.12, sway * 0.4), opacity: 1, offset: 0.12 },
        { transform: at(0.4, -sway * 0.6), opacity: 1, offset: 0.4 },
        { transform: at(0.7, sway), opacity: 0.85, offset: 0.7 },
        { transform: at(1, -sway * 0.3), opacity: 0 },
      ],
      { duration: rand(1800, 3000), delay: rand(0, 600), easing: "cubic-bezier(0.37, 0, 0.63, 1)", fill: "both" },
    );
    const remove = () => svg.remove();
    anim.onfinish = remove;
    anim.oncancel = remove;
  }
}

/**
 * key: who is ticking («student:<id>» / «rafiq:<id>»); undefined = never
 * celebrate. Returns the layer to render inside a position: relative day
 * area, and celebrate() for the tick handler.
 */
export function useDayCelebration(key: string | undefined, today: string, g: GroupGender) {
  const stage = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"off" | "in" | "shown" | "out">("off");
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const dismiss = useCallback(() => {
    clear();
    setPhase("out");
    timers.current.push(window.setTimeout(() => setPhase("off"), LEAVE_MS));
  }, []);

  const celebrate = useCallback(() => {
    if (!key || !claim(key, today)) return;
    if (stage.current && !reducedMotion()) dropLeaves(stage.current);
    clear();
    setPhase("in");
    // mounted first, then shown, so the entrance transitions
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("shown")));
    timers.current.push(window.setTimeout(dismiss, MESSAGE_MS));
  }, [key, today, dismiss]);

  const p = (m: string, f: string) => pickByGroup(g, { m, f });
  const layer = (
    <div ref={stage} className={styles.stage} aria-hidden={phase === "off"}>
      {phase !== "off" && (
        <div className={`${styles.message} ${phase === "shown" ? styles.shown : ""}`} role="status" onClick={dismiss}>
          <div className={styles.messageTitle}>{p("بارك الله فيك", "بارك الله فيكِ")}</div>
          <div className={styles.messageLine}>{p("أتممتَ بنود اليوم كلّها", "أتممتِ بنود اليوم كلّها")}</div>
        </div>
      )}
    </div>
  );
  return { layer, celebrate };
}
