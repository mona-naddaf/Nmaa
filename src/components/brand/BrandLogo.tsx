import Image from "next/image";
import wordmark from "@/assets/brand/wordmark-green.png";
import styles from "./brand.module.css";

// The «على مُكث» calligraphic wordmark. next/image serves a resized copy
// (1x and 2x of the width below) instead of the 1600px original; CSS sets the
// displayed height per placement, smaller on phones.
const VARIANTS = {
  header: { height: 40, className: styles.header },
  login: { height: 64, className: styles.login },
  home: { height: 110, className: styles.home },
  print: { height: 44, className: styles.print },
} as const;

export function BrandLogo({ variant, priority = false }: { variant: keyof typeof VARIANTS; priority?: boolean }) {
  const { height, className } = VARIANTS[variant];
  const width = Math.round((height * wordmark.width) / wordmark.height);
  return (
    <Image
      src={wordmark}
      alt="على مُكث"
      width={width}
      height={height}
      priority={priority}
      className={`${styles.logo} ${className}`}
    />
  );
}
