"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import shell from "@/app/(dashboard)/shell.module.css";

// homeLog: «حفظي في البيت», only while the adults have it on
export function ChildTabs({ homeLog = false }: { homeLog?: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/family", label: "صفحتي", active: pathname === "/family" },
    ...(homeLog ? [{ href: "/family/home-log", label: "حفظي في البيت", active: pathname.startsWith("/family/home-log") }] : []),
    { href: "/family/tracker", label: "جدول المتابعة", active: pathname.startsWith("/family/tracker") },
    { href: "/family/plan", label: "خطتي", active: pathname.startsWith("/family/plan") },
    { href: "/family/family", label: "عائلتي", active: pathname.startsWith("/family/family") },
    { href: "/family/calendar", label: "التقويم", active: pathname.startsWith("/family/calendar") },
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
