"use client";

import Link from "next/link";
import styles from "./calendar.module.css";
import { useToday } from "@/lib/calendar/useToday";
import {
  countdownLabel,
  gregorianLabelWithWeekday,
  hijriLabel,
  toHijri,
  type HijriDate,
} from "@/lib/calendar/hijri";
import {
  activeOccasions,
  daysUntil,
  itemTitle,
  OCCASIONS,
  todayMessage,
  upcomingItems,
  type Adjustment,
  type CalendarItem,
  type CustomEvent,
  type Occasion,
} from "@/lib/calendar/occasions";

// An occasion keeps its own Hijri date even when the supervisor shifted it
// for moon sighting: Eid al-Fitr moved +1 day is still "1 شوال", on the
// later Gregorian day — not the calculated "2 شوال" of that day.
export function itemHijri(item: CalendarItem): HijriDate {
  if (item.kind === "occasion") {
    const def = OCCASIONS[item.occasion];
    return { year: item.hijriYear, month: def.month, day: def.day };
  }
  return toHijri(item.date);
}

export function itemDates(item: CalendarItem): string {
  return `${hijriLabel(itemHijri(item))} · ${gregorianLabelWithWeekday(item.date)}`;
}

/** The nearest upcoming occasion or event, with its countdown. */
export function NextItemBanner({ item, today, href }: { item: CalendarItem; today: string; href?: string }) {
  const days = daysUntil(today, item);
  const isToday = days === 0;
  const icon = item.kind === "occasion" ? "🌙" : "📌";

  const content = (
    <>
      <span className={styles.bannerIcon} aria-hidden>
        {icon}
      </span>
      <div className={styles.bannerText}>
        <div className={styles.bannerTitle}>{isToday ? todayMessage(item) : itemTitle(item)}</div>
        <div className={styles.bannerDates}>{itemDates(item)}</div>
      </div>
      {!isToday && <span className={styles.countPill}>{countdownLabel(days)}</span>}
    </>
  );

  const className = `${styles.banner} ${isToday ? styles.bannerToday : ""}`;
  return href ? (
    <Link href={href} className={className} aria-label={`التقويم: ${itemTitle(item)}، ${countdownLabel(days)}`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Home-page banner. Reserves its height until the browser knows "today". */
export function CalendarBanner({
  enabledOccasions,
  adjustments,
  events,
}: {
  enabledOccasions: Occasion[];
  adjustments: Adjustment[];
  events: CustomEvent[];
}) {
  const today = useToday();
  const next = today ? upcomingItems(today, activeOccasions(enabledOccasions), adjustments, events)[0] : null;

  if (!today || !next) return <div className={`${styles.banner} ${styles.placeholder}`} aria-hidden />;
  return <NextItemBanner item={next} today={today} href="/calendar" />;
}
