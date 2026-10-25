"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { pointTo } from "@/components/nudge/nudge";
import type { GuideTarget } from "@/lib/guide/help/targets";

// Arrived from a guide link that names a place on this page (e.g. «وضع هدف»
// → «خطتي» ?to=goal): that element is scrolled to, focused and flashed once,
// and the address loses its ?to= so a reload shows the page as usual.
export function PointOnArrival({ target }: { target: GuideTarget }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-guide~="${CSS.escape(target)}"]`);
    pointTo(el);
    router.replace(pathname, { scroll: false });
  }, [target, router, pathname]);
  return null;
}
