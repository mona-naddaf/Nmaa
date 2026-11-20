"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { pointTo } from "@/components/nudge/nudge";
import { isSettingsCard } from "@/lib/guide/course-texts";

// «تفعيل الآن» in the courses' help opens «الإعدادات» at the card with the
// switch (?card=…): the card opens if it is closed, comes into view and
// flashes, with the focus on its header.
export function CardFocus() {
  const card = useSearchParams().get("card");
  useEffect(() => {
    if (!isSettingsCard(card)) return;
    const box = document.getElementById(`card-${card}`);
    const head = box?.querySelector<HTMLButtonElement>("button[aria-expanded]");
    if (head?.getAttribute("aria-expanded") === "false") head.click();
    requestAnimationFrame(() => pointTo(head ?? box));
  }, [card]);
  return null;
}
