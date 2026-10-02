import type { CollapsibleTagTone } from "./Collapsible";

// Not in Collapsible.tsx: that's a client module, and server pages build
// these tags too.

/** The usual header tag for a card with a master on/off switch. */
export const onOffTag = (on: boolean): { tag: string; tagTone: CollapsibleTagTone } => ({
  tag: on ? "مفعّل" : "غير مفعّل",
  tagTone: on ? "on" : "off",
});
