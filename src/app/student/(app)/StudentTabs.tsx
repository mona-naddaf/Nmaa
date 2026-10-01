"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import shell from "@/app/(dashboard)/shell.module.css";

export function StudentTabs({ boardEnabled, homeLogEnabled }: { boardEnabled: boolean; homeLogEnabled: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/student", label: "صفحتي", active: pathname === "/student" },
    ...(homeLogEnabled
      ? [{ href: "/student/home-log", label: "حفظي في البيت", active: pathname.startsWith("/student/home-log") }]
      : []),
    ...(boardEnabled ? [{ href: "/student/board", label: "لوحة الإنجاز", active: pathname.startsWith("/student/board") }] : []),
  ];
  return (
    <nav className={shell.nav}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`${shell.navLink} ${t.active ? shell.active : ""}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
