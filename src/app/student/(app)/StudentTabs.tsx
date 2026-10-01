"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import shell from "@/app/(dashboard)/shell.module.css";

export function StudentTabs({ boardEnabled }: { boardEnabled: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/student", label: "صفحتي", active: pathname === "/student" },
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
