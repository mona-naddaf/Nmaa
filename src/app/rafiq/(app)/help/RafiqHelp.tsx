"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HelpUI } from "@/components/guide/HelpUI";
import type { HelpHost } from "@/components/guide/host";
import type { HelpFacts } from "@/lib/guide/help/types";
import type { GuideTarget } from "@/lib/guide/help/targets";
import type { PersonGender } from "@/lib/text/gender";
import { RAFIQ_HELP } from "@/lib/guide/help/rafiq";
import { PAGE_TITLE, helpPageFor, hrefOf, tourPageFor, type TourPage } from "@/lib/guide/help/rafiq/pages";
import { FEATURE_OFFER, HELP_UI } from "@/lib/guide/help/rafiq/ui";
import { enableFeature } from "../guide/enable";

// «رفيق الحفظ»'s help (the engine is src/components/guide): her pages' help,
// where they are, and «تفعيل الآن» through the settings' own actions, the
// same switches as in «الإعدادات» (../guide/enable). Loaded by the guide's
// provider only while the guidance is on.

export default function RafiqHelp({ gender, facts }: { gender: PersonGender; facts: HelpFacts }) {
  const pathname = usePathname();
  const router = useRouter();
  const helpPage = helpPageFor(pathname);

  const host: HelpHost<GuideTarget, TourPage> = useMemo(
    () => ({
      gender,
      here: tourPageFor(pathname),
      page: (helpPage && RAFIQ_HELP[helpPage]) ?? null,
      helpOf: (p) => (p === "family" ? null : (RAFIQ_HELP[p] ?? null)),
      facts,
      title: (p) => PAGE_TITLE[p],
      hrefOf,
      go: (href) => router.push(href),
      enable: async (feature) => {
        const r = await enableFeature(feature);
        if (!r.error) router.refresh();
        return r;
      },
      cityHref: "/rafiq/settings#city",
      texts: HELP_UI,
      offers: FEATURE_OFFER,
    }),
    [gender, pathname, helpPage, facts, router],
  );

  return <HelpUI host={host} />;
}
