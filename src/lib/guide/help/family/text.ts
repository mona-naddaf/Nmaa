import type { PersonGender } from "@/lib/text/gender";

// «العائلة»'s guide texts are written as on their review page: [f|m] for the
// viewer (left to genderText, as everywhere), and here, before that:
// <f|m> for the child the text is about, {name} her name, {family} the
// family's name and {founder} the founder's (U3 when she has none). Pure.

const CHILD_PAIR = /<([^<>|]*)\|([^<>|]*)>/g;

export type FamilyWho = {
  child?: { name: string; gender: PersonGender };
  family?: string;
  founder?: string;
};

/** Fills a text's child forms and names; the viewer's [f|m] stay for genderText. */
export function fillFamily(text: string, who: FamilyWho): string {
  let out = text;
  if (who.child) {
    const female = who.child.gender === "FEMALE";
    out = out.replace(CHILD_PAIR, (_, f: string, m: string) => (female ? f : m)).replace(/\{name\}/g, who.child.name);
  }
  if (who.family !== undefined) out = out.replace(/\{family\}/g, who.family);
  if (who.founder !== undefined) out = out.replace(/\{founder\}/g, who.founder);
  return out;
}

/** U3: the founder as the view-only lines name her: her name, else «مؤسِّسة العائلة» / «مؤسِّس العائلة». */
export function founderLabel(founder: { name: string | null; gender: PersonGender }): string {
  const name = founder.name?.trim();
  if (name) return name;
  return founder.gender === "FEMALE" ? "مؤسِّسة العائلة" : "مؤسِّس العائلة";
}

/** True when no <…|…> pair or {…} name is left (a test helper for the content files). */
export function familyFilled(text: string): boolean {
  return !/<[^<>]*\|[^<>]*>|\{(name|family|founder)\}/.test(text);
}
