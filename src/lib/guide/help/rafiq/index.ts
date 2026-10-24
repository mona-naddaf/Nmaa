import type { GuidePage } from "../../keys";
import type { GuideTarget } from "../targets";
import type { HelpPage } from "../types";
import type { TourPage } from "./pages";
import { home } from "./home";
import { plan } from "./plan";
import { homelog } from "./homelog";
import { segment } from "./segment";
import { tracker } from "./tracker";
import { summary } from "./summary";
import { templates } from "./templates";

// «رفيق الحفظ»'s help, one content file per page (review page ٤, v17).

export type RafiqHelpPage = HelpPage<GuideTarget, TourPage>;

export const RAFIQ_HELP: Partial<Record<GuidePage, RafiqHelpPage>> = {
  home,
  plan,
  homelog,
  segment,
  tracker,
  summary,
  templates,
};
