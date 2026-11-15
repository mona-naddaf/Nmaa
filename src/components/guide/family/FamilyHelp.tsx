"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HelpUI } from "@/components/guide/HelpUI";
import type { HelpHost } from "@/components/guide/host";
import type { PressLabel } from "@/lib/guide/help/run";
import type { GuideTarget } from "@/lib/guide/help/targets";
import type { EnableFeature, HelpFacts } from "@/lib/guide/help/types";
import type { FamilyHelpPage, FamilyPageId } from "@/lib/guide/help/family/types";
import { adultChildHrefOf, adultChildPageFor, childHrefOf, childPageFor, familyHrefOf, familyPageFor } from "@/lib/guide/help/family/pages";
import { FEATURE_OFFER, HELP_UI, PRESS_LABELS } from "@/lib/guide/help/rafiq/ui";
import type { PersonGender } from "@/lib/text/gender";

// «العائلة»'s help (the engine is ../HelpUI): the button, its panel and
// «أرِني» on the child's pages, on a child's pages as an adult sees them, and
// on an adult's own family pages. Its pages come ready from the server, built
// for this viewer (src/lib/guide/help/family/build.ts), so nothing here
// decides who sees what. Mounted only where FAMILY_GUIDE_EMAILS reaches the
// family.

type Pages = Partial<Record<FamilyPageId, FamilyHelpPage>>;

export type FamilyHelpWhere =
  | { kind: "child" }
  | { kind: "adult"; base: string }
  // an adult's own family pages: each family's pages, and «عائلاتي»'s
  | { kind: "family"; families: Record<string, Pages>; list: Pages };

// the family's own words for the buttons a tour waits on
const FAMILY_LABELS: Partial<Record<GuideTarget, PressLabel>> = {
  "calendar.add": "+ إضافة مناسبة عائلية",
  "family.create": "+ إنشاء عائلة",
  "family.join": "الانضمام إلى عائلة",
  "family.addChild": "+ إضافة طفل",
  "tracker.copy": "نسخ الجدول إلى…",
};

export function FamilyHelp({
  where,
  gender,
  pages = {},
  titles,
  facts,
  preview,
  enabledText,
  settingsLabel,
  enable,
}: {
  where: FamilyHelpWhere;
  gender: PersonGender;
  // the child's pages, or one child's pages for an adult
  pages?: Pages;
  // each page's name, filled for this child
  titles: Record<FamilyPageId, string>;
  facts: HelpFacts;
  preview?: boolean;
  // U5, filled with her name (an adult with edit rights)
  enabledText?: string;
  // «إعدادات {name}», filled: the tab a tour waits on
  settingsLabel?: string;
  // «تفعيل الآن» (an adult with edit rights): the child's switch, through the family's action
  enable?: (feature: EnableFeature) => Promise<{ error?: string }>;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const host: HelpHost<GuideTarget, FamilyPageId> = useMemo(() => {
    let here: FamilyPageId | null = null;
    let mine: Pages = pages;
    let hrefOf: (p: FamilyPageId) => string | null;
    if (where.kind === "child") {
      here = childPageFor(pathname);
      hrefOf = childHrefOf;
    } else if (where.kind === "adult") {
      here = adultChildPageFor(pathname, where.base);
      hrefOf = (p) => adultChildHrefOf(p, where.base);
    } else {
      const at = familyPageFor(pathname);
      here = at?.page ?? null;
      const familyId = at?.familyId ?? null;
      mine = familyId ? (where.families[familyId] ?? {}) : where.list;
      hrefOf = (p) => familyHrefOf(p, familyId);
    }
    return {
      gender,
      path: pathname,
      ...(preview ? { preview } : {}),
      here,
      page: here ? (mine[here] ?? null) : null,
      helpOf: (p) => mine[p] ?? null,
      facts,
      title: (p) => titles[p],
      hrefOf,
      go: (href) => router.push(href),
      enable: async (feature) => {
        if (!enable) return { error: "unavailable" };
        const r = await enable(feature);
        if (!r.error) router.refresh();
        return r;
      },
      cityHref: "/rafiq/settings#city",
      texts: enabledText ? { ...HELP_UI, enabled: enabledText } : HELP_UI,
      offers: FEATURE_OFFER,
      labels: { ...PRESS_LABELS, ...FAMILY_LABELS, ...(settingsLabel ? { "child.settingsTab": settingsLabel } : {}) },
    };
  }, [where, gender, pages, titles, facts, preview, enabledText, settingsLabel, enable, pathname, router]);

  return <HelpUI host={host} />;
}
