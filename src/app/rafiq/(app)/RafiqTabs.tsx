"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import shell from "@/app/(dashboard)/shell.module.css";

// family: «عائلتي» (only while «العائلة» is on, src/lib/family/enabled.ts)
export function RafiqTabs({ family = false }: { family?: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/rafiq", label: "صفحتي", active: pathname === "/rafiq" },
    { href: "/rafiq/home-log", label: "حفظي في البيت", active: pathname.startsWith("/rafiq/home-log") },
    { href: "/rafiq/tracker", label: "جدول المتابعة", active: pathname.startsWith("/rafiq/tracker") },
    { href: "/rafiq/calendar", label: "التقويم", active: pathname.startsWith("/rafiq/calendar") },
    ...(family ? [{ href: "/rafiq/family", label: "عائلتي", active: pathname.startsWith("/rafiq/family") }] : []),
    {
      href: "/rafiq/notes",
      label: "ملاحظاتي",
      active: pathname.startsWith("/rafiq/notes") || pathname.startsWith("/rafiq/verse"),
    },
    { href: "/rafiq/plan", label: "خطتي", active: pathname.startsWith("/rafiq/plan") },
    { href: "/rafiq/settings", label: "الإعدادات", active: pathname.startsWith("/rafiq/settings") },
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
