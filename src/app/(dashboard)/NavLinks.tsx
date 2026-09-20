"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

export function NavLinks({ showSettings }: { showSettings: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/students", label: "قائمة الطالبات" },
    { href: "/leaderboard", label: "لوحة الإنجاز" },
    { href: "/reports", label: "التقارير" },
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
