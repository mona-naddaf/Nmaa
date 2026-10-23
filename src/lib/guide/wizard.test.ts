import { test } from "node:test";
import assert from "node:assert/strict";
import { everyDaysLabel, landing, nextScreen, presetLabel, prevScreen, questionOf, questionsLeft, reviewChoices, type Screen } from "./wizard";

const withPlan = { hasPlan: true, bankCount: 3 };
const noPlan = { hasPlan: false, bankCount: 3 };
const emptyBank = { hasPlan: true, bankCount: 0 };

test("wizard: the whole way through, with every branch taken", () => {
  const path: Screen[] = ["welcome"];
  const branch = { tracker: "yes", withTimes: "yes" } as const;
  while (path.at(-1) !== "done") path.push(nextScreen(path.at(-1)!, withPlan, branch));
  assert.deepEqual(path, ["welcome", "q1", "q2", "q3", "q4", "q4a", "q4b", "q4c", "q5", "done"]);
});

test("wizard: no plan (skipped, or «أختار السور بنفسي») skips the prior question", () => {
  assert.equal(nextScreen("q1", noPlan), "q3");
  assert.equal(nextScreen("q1", withPlan), "q2");
});

test("wizard: an empty bank goes straight from «نعم» to the times question", () => {
  assert.equal(nextScreen("q4", emptyBank, { tracker: "yes" }), "q4b");
  assert.equal(nextScreen("q4", withPlan, { tracker: "yes" }), "q4a");
});

test("wizard: «لا» or «تخطٍّ» on the tracker and times questions goes on to the review question", () => {
  assert.equal(nextScreen("q4", withPlan, { tracker: "no" }), "q5");
  assert.equal(nextScreen("q4", withPlan), "q5");
  assert.equal(nextScreen("q4a", withPlan), "q4b");
  assert.equal(nextScreen("q4b", withPlan, { withTimes: "no" }), "q5");
  assert.equal(nextScreen("q4b", withPlan), "q5");
  assert.equal(nextScreen("q4c", withPlan), "q5");
  assert.equal(nextScreen("q5", withPlan), "done");
});

test("wizard: «السؤال n من 5» — the sub-screens of the tracker are all question 4", () => {
  assert.equal(questionOf("welcome"), null);
  assert.equal(questionOf("done"), null);
  assert.equal(questionOf("q1"), 1);
  for (const s of ["q4", "q4a", "q4b", "q4c"] as const) assert.equal(questionOf(s), 4);
  assert.equal(questionOf("q5"), 5);
});

test("wizard: a resume lands on the question she stopped at", () => {
  assert.equal(landing({ done: false, step: null, facts: withPlan }), "welcome");
  assert.equal(landing({ done: false, step: 1, facts: withPlan }), "q1");
  assert.equal(landing({ done: false, step: 4, facts: withPlan }), "q4");
  assert.equal(landing({ done: false, step: 5, facts: withPlan }), "q5");
  // the prior question needs a plan
  assert.equal(landing({ done: false, step: 2, facts: noPlan }), "q3");
  assert.equal(landing({ done: false, step: 2, facts: withPlan }), "q2");
  // finished: the summary
  assert.equal(landing({ done: true, step: 3, facts: withPlan }), "done");
  // out of range: clamped
  assert.equal(landing({ done: false, step: 9, facts: withPlan }), "q5");
  assert.equal(landing({ done: false, step: 0, facts: withPlan }), "welcome");
});

test("wizard: «السابق» without a history goes to the screen before", () => {
  assert.equal(prevScreen("q1", withPlan), "welcome");
  assert.equal(prevScreen("q3", withPlan), "q2");
  assert.equal(prevScreen("q3", noPlan), "q1");
  assert.equal(prevScreen("q4b", withPlan), "q4a");
  assert.equal(prevScreen("q4b", emptyBank), "q4");
  assert.equal(prevScreen("q4c", withPlan), "q4b");
  assert.equal(prevScreen("q5", withPlan), "q4");
});

test("wizard: review reminder choices keep her current number when it isn't a preset", () => {
  assert.deepEqual(reviewChoices(null), [7, 14, 30]);
  assert.deepEqual(reviewChoices(14), [7, 14, 30]);
  assert.deepEqual(reviewChoices(10), [7, 10, 14, 30]);
  assert.deepEqual(reviewChoices(60), [7, 14, 30, 60]);
  assert.equal(presetLabel(7), "أسبوع (7 أيام)");
  assert.equal(presetLabel(14), "أسبوعان (14 يومًا)");
  assert.equal(presetLabel(30), "شهر (30 يومًا)");
  assert.equal(presetLabel(10), "كل 10 أيام");
  assert.equal(everyDaysLabel(1), "كل يوم");
  assert.equal(everyDaysLabel(2), "كل يومين");
  assert.equal(everyDaysLabel(3), "كل 3 أيام");
  assert.equal(everyDaysLabel(45), "كل 45 يومًا");
});

test("wizard: questions left on the resume card", () => {
  assert.equal(questionsLeft(1), "سؤال واحد");
  assert.equal(questionsLeft(2), "سؤالان");
  assert.equal(questionsLeft(3), "3 أسئلة");
  assert.equal(questionsLeft(5), "5 أسئلة");
});
