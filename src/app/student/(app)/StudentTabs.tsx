"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import shell from "@/app/(dashboard)/shell.module.css";

export function StudentTabs({
  boardEnabled,
  homeLogEnabled,
  assignmentsEnabled,
  trackerEnabled,
}: {
  boardEnabled: boolean;
  homeLogEnabled: boolean;
  assignmentsEnabled: boolean;
  trackerEnabled: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: "/student", label: "صفحتي", active: pathname === "/student" },
    ...(homeLogEnabled
      ? [{ href: "/student/home-log", label: "حفظي في البيت", active: pathname.startsWith("/student/home-log") }]
      : []),
    ...(assignmentsEnabled
      ? [{ href: "/student/assignments", label: "الواجبات", active: pathname.startsWith("/student/assignments") }]
      : []),
    ...(trackerEnabled ? [{ href: "/student/tracker", label: "جدول المتابعة", active: pathname.startsWith("/student/tracker") }] : []),
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
