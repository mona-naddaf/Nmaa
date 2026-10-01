import styles from "./home-log.module.css";
import { SURAH_NAME } from "@/lib/quran-data";
import { HOME_TAP_ICON, HOME_TAP_KINDS, HOME_TAP_LABEL, targetFor, type HomeCounts, type HomeTargets } from "@/lib/home-log/rules";

export const segmentTitle = (s: { surahNumber: number; fromAyah: number; toAyah: number }) =>
  `${SURAH_NAME[s.surahNumber]} — ${s.fromAyah === s.toAyah ? `الآية ${s.fromAyah}` : `الآيات ${s.fromAyah}–${s.toAyah}`}`;

/** One simple bar per target: «٣ من ٥», full and darker once reached. */
export function TargetProgress({ counts, targets }: { counts: HomeCounts; targets: HomeTargets }) {
  return (
    <div>
      {HOME_TAP_KINDS.map((k) => {
        const target = targetFor(targets, k);
        const n = counts[k];
        const pct = Math.min(100, Math.round((n / target) * 100));
        return (
          <div key={k} className={styles.progressRow}>
            <span className={styles.lbl}>
              {HOME_TAP_ICON[k]} {HOME_TAP_LABEL[k]}
            </span>
            <div
              className={styles.track}
              role="progressbar"
              aria-label={HOME_TAP_LABEL[k]}
              aria-valuemin={0}
              aria-valuemax={target}
              aria-valuenow={Math.min(n, target)}
            >
              <div className={`${styles.fill} ${n >= target ? styles.full : ""}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.frac}>
              {n} من {target} {n >= target ? "✓" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
