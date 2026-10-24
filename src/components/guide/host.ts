import type { PersonGender } from "@/lib/text/gender";
import type { HelpFacts, HelpFeature, HelpPage } from "@/lib/guide/help/types";
import type { HELP_UI } from "@/lib/guide/help/rafiq/ui";

// What a site gives the help engine (the button, its panel and «أرِني»):
// its pages' help, where they are, what she has switched on, and how to
// switch a feature on when she asks. «رفيق الحفظ» is the first such site
// ((app)/help/RafiqHelp.tsx); the courses can bring their own later.

export type HelpTexts = typeof HELP_UI;

export type HelpHost<T extends string = string, P extends string = string> = {
  gender: PersonGender;
  // the page she is on, as far as a tour knows it (null: none of the guide's pages)
  here: P | null;
  // its help: null where the button doesn't show
  page: HelpPage<T, P> | null;
  facts: HelpFacts;
  title: (page: P) => string;
  hrefOf: (page: P) => string | null;
  go: (href: string) => void;
  // switches the feature on when she presses «تفعيل الآن» (never on its own)
  enable: (feature: HelpFeature) => Promise<{ error?: string }>;
  // where a city is picked
  cityHref: string;
  texts: HelpTexts;
  offers: Record<HelpFeature, string>;
};
