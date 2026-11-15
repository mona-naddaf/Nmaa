"use client";

import Link from "next/link";
import type { GuideTarget } from "@/lib/guide/help/targets";
import { useGuideTarget } from "./targets";

/** A link a server page renders, named for «أرِني» only where the guide names it (no attribute anywhere else). */
export function GuideLink({ name, ...props }: React.ComponentProps<typeof Link> & { name: GuideTarget }) {
  const t = useGuideTarget();
  return <Link {...props} {...t(name)} />;
}
