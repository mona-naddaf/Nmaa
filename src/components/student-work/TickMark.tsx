import styles from "./motion.module.css";

/**
 * The checkmark inside every tick control on «جدول المتابعة» (timeline
 * circle, chip dot, tile box). Always rendered: marking draws its stroke,
 * unmarking takes it away faster. Its colour is the control's (currentColor).
 */
export function TickMark({ on }: { on: boolean }) {
  return (
    <svg className={`${styles.tick} ${on ? styles.tickOn : ""}`} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
    </svg>
  );
}
