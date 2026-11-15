"use server";

import {
  ackMilestone,
  addFullDays,
  addOwed,
  deleteAll,
  deleteLine,
  loadView,
  logMadeUp,
  previewEstimate,
  qadaGate,
  saveEstimate,
  setAverage,
  setGoal,
  type QadaView,
} from "@/lib/qada/server";

// «القضاء»: the card's actions on every tracker page of «رفيق الحفظ» and
// «العائلة». An action is posted to the page it's used on, so it carries that
// area's cookie (/rafiq: the adult; /family: the child); qadaGate decides from
// the database each time. subjectId: a child's id when an adult is on the
// child's page. zone: the browser's time zone (her days). Every answer is the
// card's fresh data, cut to what the one asking may see.

type Answer = { view: QadaView; id?: string } | { error: string };

const gate = (subjectId: unknown) => qadaGate(subjectId, "record");

export async function loadQadaAction(input: { subjectId?: string; zone: string }): Promise<{ view: QadaView } | { error: string }> {
  const g = await qadaGate(input?.subjectId, "view");
  return "error" in g ? g : { view: await loadView(g, input.zone) };
}

export async function logMadeUpAction(input: { subjectId?: string; zone: string; kind: string; day?: string; count?: number }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : logMadeUp(g, input);
}

export async function addOwedAction(input: { subjectId?: string; zone: string; kind: string; count: number; day?: string | null }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : addOwed(g, { ...input, day: input.day ?? null });
}

export async function addFullDaysAction(input: { subjectId?: string; zone: string; days: number }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : addFullDays(g, input);
}

export async function deleteQadaLineAction(input: { subjectId?: string; zone: string; id: string }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : deleteLine(g, input);
}

export async function previewEstimateAction(input: { subjectId?: string; answers: unknown }) {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : previewEstimate(g, input.answers);
}

export async function saveEstimateAction(input: { subjectId?: string; zone: string; answers: unknown; preview: unknown }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : saveEstimate(g, input);
}

export async function setQadaGoalAction(input: { subjectId?: string; zone: string; track: string; mode: string; deadline?: string; pace?: number }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : setGoal(g, input);
}

export async function setQadaAverageAction(input: { subjectId?: string; zone: string; days: number }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : setAverage(g, input);
}

export async function ackQadaMilestoneAction(input: { subjectId?: string; zone: string; track: string; level: number }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : ackMilestone(g, input);
}

export async function deleteAllQadaAction(input: { subjectId?: string; zone: string; word: string }): Promise<Answer> {
  const g = await gate(input?.subjectId);
  return "error" in g ? g : deleteAll(g, input);
}
