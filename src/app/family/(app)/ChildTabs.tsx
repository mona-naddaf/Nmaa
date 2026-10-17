"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import shell from "@/app/(dashboard)/shell.module.css";

export function ChildTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/family", label: "صفحتي", active: pathname === "/family" },
    { href: "/family/tracker", label: "جدول المتابعة", active: pathname.startsWith("/family/tracker") },
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
