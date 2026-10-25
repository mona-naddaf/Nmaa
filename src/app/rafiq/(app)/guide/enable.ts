import type { HelpFeature } from "@/lib/guide/help/types";
import { REVIEW_DAYS_ON_ENABLE } from "@/lib/guide/help/rafiq/ui";
import {
  setAgendaEnabledAction,
  setMutashabihatEnabledAction,
  setReviewRemindersAction,
  setSummaryEnabledAction,
  setTajweedDetailEnabledAction,
} from "../settings/actions";

// A feature switched on from the guidance («تفعيل الآن» in a tour, «تفعيل» on
// an intro line), only on her press: the settings' own actions, the same
// switches as in «الإعدادات». The review reminder starts at 14 days.

type SettingsAction = (prev: null, formData: FormData) => Promise<{ error?: string } | null>;

const SWITCH: Record<HelpFeature, [SettingsAction, Record<string, string>]> = {
  agenda: [setAgendaEnabledAction, { on: "1" }],
  summary: [setSummaryEnabledAction, { on: "1" }],
  similar: [setMutashabihatEnabledAction, { on: "1" }],
  tajweed: [setTajweedDetailEnabledAction, { on: "1" }],
  review: [setReviewRemindersAction, { on: "1", days: String(REVIEW_DAYS_ON_ENABLE) }],
};

export async function enableFeature(feature: HelpFeature): Promise<{ error?: string }> {
  const [action, fields] = SWITCH[feature];
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const r = await action(null, fd);
  return { error: r?.error };
}
