import type { GuidePage } from "../../keys";
import type { RafiqHelpPage } from "./index";

// The shape of the «أيام العذر» guide, and how a page's help takes it in.
// Only names and types: the texts live in ./excuse, on the server, and reach
// a browser only inside her own snapshot (getGuide), so this file can be
// imported by the client.

export type ExcuseGuide = {
  // the feature is on for her
  on: boolean;
  line: { tracker: string; home: string; button: string };
  enabled: { tracker: string; home: string };
  help: Partial<Record<GuidePage, RafiqHelpPage["questions"]>>;
};

/** A page's help with her excuse questions after its own (always under «أسئلة أخرى»). */
export function withExcuseHelp(page: RafiqHelpPage, excuse: ExcuseGuide | null | undefined): RafiqHelpPage {
  const extra = excuse?.help[page.id as GuidePage];
  return extra?.length ? { ...page, questions: [...page.questions, ...extra] } : page;
}
