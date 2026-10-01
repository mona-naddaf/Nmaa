"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

export function NavLinks({
  showSettings,
  showCalendar,
  showAssignments,
  showTracker,
}: {
  showSettings: boolean;
  showCalendar: boolean;
  showAssignments: boolean;
  showTracker: boolean;
}) {
  const pathname = usePathname();
  const links = [
    { href: "/students", label: "قائمة الطلاب" },
    { href: "/leaderboard", label: "لوحة الإنجاز" },
    ...(showAssignments ? [{ href: "/assignments", label: "الواجبات" }] : []),
    ...(showTracker ? [{ href: "/tracker", label: "جدول المتابعة" }] : []),
    { href: "/reports", label: "التقارير" },
    ...(showCalendar ? [{ href: "/calendar", label: "التقويم" }] : []),
    { href: "/resources", label: "بنك الوسائل" },
    ...(showSettings ? [{ href: "/settings", label: "الإعدادات" }] : []),
  ];

  return (
    <nav className={styles.nav}>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`${styles.navLink} ${pathname.startsWith(l.href) ? styles.active : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
