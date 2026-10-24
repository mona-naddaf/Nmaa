// What Tab can reach inside an element, in page order (hidden ones left out).
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement): HTMLElement[] {
  const inside = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const all = root.matches(FOCUSABLE) ? [root, ...inside] : inside;
  return all.filter((el) => el.getClientRects().length > 0);
}
