// «القضاء»: who sees what of whose qada. Pure; the server decides with this
// before anything is loaded, so what a viewer may not see never reaches her
// browser (the page's data and every action's answer are cut to it).
//
// - an adult's own qada: hers alone. Never shared with her family (not by
//   «مشاركة تقدّمي/جدولي», not siblings).
// - a child's: the child herself and the adults with edit rights. View-only
//   adults see nothing at all.
// - a girl's fasting qada, her average excuse days and anything worked out
//   from them (the daily plan, the goals, the dates) only reach the adults
//   in her «من يرى أن {الاسم} معذورة؟» list (rows, or else women yes and men
//   no — even with «أيام العذر» off). An adult with edit rights outside the
//   list sees the prayers' totals, what's left, progress and the log —
//   without any dates (Mona, 2026-11-15) — and adds prayers by hand; nothing
//   that could show her pattern (rule 14).

export type QadaViewer = "self" | "child" | "adult-edit" | "adult-view";

export type QadaAccess = {
  // log, add, delete (what she sees)
  edit: boolean;
  // fasting qada (a girl's: only for the list)
  fasting: boolean;
  // the goals, today's amount, finish dates, the estimate and the average excuse days
  plan: boolean;
  // the dates of the log's lines (day and when it was added)
  dates: boolean;
  // «كم يوم العذر في الشهر تقريبًا؟» and everything excuse-aware: a woman's or a girl's own qada
  excuseAware: boolean;
  // the milestones and the final celebration: the owner herself
  milestones: boolean;
  // «حذف كل بيانات القضاء»
  deleteAll: boolean;
};

export type QadaSubject = { kind: "ADULT" | "CHILD"; gender: "MALE" | "FEMALE" };

/**
 * What the viewer gets; null: nothing (the card isn't there). inList: the
 * adult is in the girl's «من يرى…» list (ignored for anyone else).
 */
export function qadaAccess(viewer: QadaViewer, subject: QadaSubject, inList: boolean): QadaAccess | null {
  const excuseAware = subject.gender === "FEMALE";
  const full: QadaAccess = { edit: true, fasting: true, plan: true, dates: true, excuseAware, milestones: false, deleteAll: true };
  switch (viewer) {
    case "self":
      return subject.kind === "ADULT" ? { ...full, milestones: true } : null;
    case "child":
      return subject.kind === "CHILD" ? { ...full, milestones: true } : null;
    case "adult-view":
      return null;
    case "adult-edit":
      if (subject.kind !== "CHILD") return null;
      if (subject.gender === "MALE" || inList) return full;
      return { edit: true, fasting: false, plan: false, dates: false, excuseAware: false, milestones: false, deleteAll: false };
  }
}

// ---------- Phase 2 ----------

/** The Ramadan offer: her fasting and her excuse are this viewer's to see, and her «أيام العذر» is on. */
export const ramadanOfferShown = (a: QadaAccess | null, excuseOn: boolean) => !!a && a.plan && a.fasting && a.excuseAware && excuseOn;

/** The line before Ramadan: the owner herself (a child too); on a girl's page, the adults in her list; never a boy's adults. */
export const reminderShown = (viewer: QadaViewer, subject: QadaSubject, a: QadaAccess | null) =>
  !!a && a.plan && a.fasting && (viewer === "self" || viewer === "child" || subject.gender === "FEMALE");

/** Her predicted cycle (and «استعمال رقمي أنا»): whoever sees her average. */
export const predictionShown = (a: QadaAccess | null) => !!a && a.plan && a.excuseAware;
