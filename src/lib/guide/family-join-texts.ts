// The welcome card on a family's page after joining it (the family guide's
// review page, J1–J3, approved 2026-11-15), in its notation: [f|m] the adult,
// {family} the family's name. Filled by fillFamily, then genderText. Edit the
// texts only with Mona.

export const FAMILY_JOIN = {
  title: "أهلًا [بكِ|بك] في «{family}» 🌿",
  sub: "[تستطيعين|تستطيع] متابعة تقدّم أطفال العائلة من هنا.",
  // only without a plan of her own
  setup: "وإن [أردتِ|أردتَ] أن [تحفظي|تحفظ] [أنتِ|أنت] أيضًا، [جهّزي|جهّز] [صفحتكِ|صفحتك].",
  setupBtn: "[جهّزي|جهّز] صفحتي",
} as const;
