"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HelpUI } from "@/components/guide/HelpUI";
import type { HelpHost } from "@/components/guide/host";
import type { HelpFacts, HelpFeature } from "@/lib/guide/help/types";
import type { GuideTarget } from "@/lib/guide/help/targets";
import type { PersonGender } from "@/lib/text/gender";
import { RAFIQ_HELP } from "@/lib/guide/help/rafiq";
import { PAGE_TITLE, helpPageFor, hrefOf, tourPageFor, type TourPage } from "@/lib/guide/help/rafiq/pages";
import { FEATURE_OFFER, HELP_UI, REVIEW_DAYS_ON_ENABLE } from "@/lib/guide/help/rafiq/ui";
import {
  setAgendaEnabledAction,
  setMutashabihatEnabledAction,
  setReviewRemindersAction,
  setSummaryEnabledAction,
  setTajweedDetailEnabledAction,
} from "../settings/actions";

// «رفيق الحفظ»'s help (the engine is src/components/guide): her pages' help,
// where they are, and «تفعيل الآن» through the settings' own actions, the
// same switches as in «الإعدادات». Loaded by the guide's provider only while
// the guidance is on.

type SettingsAction = (prev: null, formData: FormData) => Promise<{ error?: string } | null>;

const SWITCH: Record<HelpFeature, [SettingsAction, Record<string, string>]> = {
  agenda: [setAgendaEnabledAction, { on: "1" }],
  summary: [setSummaryEnabledAction, { on: "1" }],
  similar: [setMutashabihatEnabledAction, { on: "1" }],
  tajweed: [setTajweedDetailEnabledAction, { on: "1" }],
  review: [setReviewRemindersAction, { on: "1", days: String(REVIEW_DAYS_ON_ENABLE) }],
};

export default function RafiqHelp({ gender, facts }: { gender: PersonGender; facts: HelpFacts }) {
  const pathname = usePathname();
  const router = useRouter();
  const helpPage = helpPageFor(pathname);

  const host: HelpHost<GuideTarget, TourPage> = useMemo(
    () => ({
      gender,
      here: tourPageFor(pathname),
      page: (helpPage && RAFIQ_HELP[helpPage]) ?? null,
      facts,
      title: (p) => PAGE_TITLE[p],
      hrefOf,
      go: (href) => router.push(href),
      enable: async (feature) => {
        const [action, fields] = SWITCH[feature];
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        const r = await action(null, fd);
        if (!r?.error) router.refresh();
        return { error: r?.error };
      },
      cityHref: "/rafiq/settings#city",
      texts: HELP_UI,
      offers: FEATURE_OFFER,
    }),
    [gender, pathname, helpPage, facts, router],
  );

  return <HelpUI host={host} />;
}
