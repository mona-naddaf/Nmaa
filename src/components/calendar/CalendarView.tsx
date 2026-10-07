"use client";

import { useState, useTransition } from "react";
import styles from "./calendar.module.css";
import { useToday } from "@/lib/calendar/useToday";
import {
  addDays,
  countdownLabel,
  fromHijri,
  gregorianLabel,
  gregorianLabelWithWeekday,
  GREGORIAN_MONTHS,
  hijriLabel,
  hijriMonthLength,
  HIJRI_MONTHS,
  shiftHijriMonth,
  toHijri,
  weekday,
  WEEKDAYS,
} from "@/lib/calendar/hijri";
import {
  activeOccasions,
  adjustableYears,
  adjustmentLabel,
  daysUntil,
  itemsInRange,
  itemTitle,
  OCCASIONS,
  OPTIONAL_OCCASIONS,
  upcomingItems,
  type Adjustment,
  type CalendarItem,
  type CustomEvent,
  type Occasion,
} from "@/lib/calendar/occasions";
import { imperative, type PersonGender } from "@/lib/text/gender";
import { itemDates, NextItemBanner } from "./CalendarBanner";
import { EventForm, type EventInput } from "./EventForm";

type ActionResult = Promise<{ error?: string }>;

/** What the calendar can do: the course's actions, or «رفيق الحفظ»'s own. */
export type CalendarActions = {
  createEvent: (input: EventInput) => ActionResult;
  updateEvent: (eventId: string, input: EventInput) => ActionResult;
  deleteEvent: (eventId: string) => ActionResult;
  setOptionalOccasion: (occasion: string, enabled: boolean) => ActionResult;
  setAdjustment: (occasion: string, hijriYear: number, offsetDays: number) => ActionResult;
};

/** The calendar's own-event wording; the course's is the default. */
export type CalendarWording = {
  eventLegend: string;
  addEventOnDay: string;
  addEvent: string;
  newEvent: string;
  editEvent: string;
  confirmDeleteEvent: string;
  emptyDay: string;
  optionalIntro: string;
  pastTitle: string;
  pastEmpty: string;
  adjustNote: string;
  titleRequired: string;
};

export const COURSE_CALENDAR_WORDING: CalendarWording = {
  eventLegend: "فعالية للدورة",
  addEventOnDay: "+ إضافة فعالية في هذا اليوم",
  addEvent: "+ إضافة فعالية",
  newEvent: "فعالية جديدة",
  editEvent: "تعديل الفعالية",
  confirmDeleteEvent: "حذف هذه الفعالية نهائيًا؟",
  emptyDay: "لا توجد مناسبات أو فعاليات في هذا اليوم.",
  optionalIntro: "تظهر المناسبات الأساسية (رمضان، والعيدان، ويوم عرفة) دائمًا. ويمكن إضافة ما يلي إلى تقويم الدورة:",
  pastTitle: "سجل الفعاليات السابقة",
  pastEmpty: "لم تُسجَّل فعاليات سابقة بعد.",
  adjustNote: " يمكن تعديل موعد أي مناسبة للعام الحالي والقادم من قائمة القادم أو من يومها في التقويم.",
  titleRequired: "يُرجى إدخال عنوان الفعالية",
};

type FormState = { kind: "new"; date: string } | { kind: "edit"; event: CustomEvent } | null;

const ADJUST_OPTIONS = [
  { value: -2, label: "تقديم يومين" },
  { value: -1, label: "تقديم يوم" },
  { value: 0, label: "بلا تعديل (أم القرى)" },
  { value: 1, label: "تأخير يوم" },
  { value: 2, label: "تأخير يومين" },
];

export function CalendarView({
  enabledOccasions,
  adjustments,
  events,
  canManage,
  canAdjust,
  viewerGender,
  actions,
  wording: w = COURSE_CALENDAR_WORDING,
}: {
  enabledOccasions: Occasion[];
  adjustments: Adjustment[];
  events: CustomEvent[];
  canManage: boolean;
  // may shift an occasion's date for moon sighting
  canAdjust: boolean;
  viewerGender: PersonGender;
  actions: CalendarActions;
  wording?: CalendarWording;
}) {
  const today = useToday();
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [adjustKey, setAdjustKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // everything below depends on the viewer's own "today"
  if (!today) return <div className={styles.card} style={{ minHeight: 320 }} aria-busy />;

  const occasions = activeOccasions(enabledOccasions);
  const todayHijri = toHijri(today);
  const month = view ?? { year: todayHijri.year, month: todayHijri.month };
  const monthStart = fromHijri(month.year, month.month, 1)!;
  const monthLength = hijriMonthLength(month.year, month.month);
  const monthEnd = addDays(monthStart, monthLength - 1);
  const monthItems = itemsInRange(monthStart, monthEnd, occasions, adjustments, events);
  const isCurrentMonth = month.year === todayHijri.year && month.month === todayHijri.month;
  const selectedDay = selected ?? (isCurrentMonth ? today : null);

  const upcoming = upcomingItems(today, occasions, adjustments, events);
  const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const adjustable = new Set(adjustableYears(todayHijri.year));

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  function goToMonth(delta: number) {
    setView(shiftHijriMonth(month.year, month.month, delta));
    setSelected(null);
  }

  function jumpTo(date: string) {
    const h = toHijri(date);
    setView({ year: h.year, month: h.month });
    setSelected(date);
  }

  async function submitForm(input: EventInput) {
    const result =
      form?.kind === "edit" ? await actions.updateEvent(form.event.id, input) : await actions.createEvent(input);
    if (!result.error) {
      setForm(null);
      jumpTo(input.date);
    }
    return result;
  }

  // ---------- pieces ----------

  function renderRow(item: CalendarItem, showCountdown: boolean) {
    const days = daysUntil(today!, item);
    const adjustableItem = canAdjust && item.kind === "occasion" && adjustable.has(item.hijriYear);
    const event = item.kind === "event" ? item.event : null;

    return (
      <div key={item.key} className={styles.row}>
        <span className={`${styles.rowMark} ${item.kind === "occasion" ? styles.occasion : ""}`} />
        <div className={styles.rowBody}>
          <button type="button" className={styles.rowTitle} onClick={() => jumpTo(item.date)}>
            {itemTitle(item)}
          </button>
          {item.kind === "occasion" && item.offsetDays !== 0 && (
            <span
              className={`${styles.badge} ${styles.badgeAdjusted}`}
              title={`الموعد المحسوب وفق أم القرى: ${gregorianLabelWithWeekday(item.baseDate)}`}
            >
              مُعدَّل: {adjustmentLabel(item.offsetDays)}
            </span>
          )}
          <div className={styles.rowDates}>{itemDates(item)}</div>
          {event?.description && <div className={styles.rowDesc}>{event.description}</div>}

          {(adjustableItem || event?.editable) && (
            <div className={styles.rowActions}>
              {adjustableItem &&
                item.kind === "occasion" &&
                (adjustKey === item.key ? (
                  <select
                    className={styles.smallSelect}
                    value={item.offsetDays}
                    disabled={pending}
                    aria-label={`تعديل موعد ${itemTitle(item)} ${item.hijriYear} هـ`}
                    onChange={(e) =>
                      run(
                        () => actions.setAdjustment(item.occasion, item.hijriYear, Number(e.target.value)),
                        () => setAdjustKey(null),
                      )
                    }
                  >
                    {ADJUST_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button type="button" className={styles.linkBtn} onClick={() => setAdjustKey(item.key)}>
                    تعديل الموعد بحسب رؤية الهلال
                  </button>
                ))}
              {event?.editable &&
                (confirmDelete === event.id ? (
                  <>
                    <span className={styles.muted}>{w.confirmDeleteEvent}</span>
                    <button
                      type="button"
                      className={`${styles.linkBtn} ${styles.danger}`}
                      disabled={pending}
                      onClick={() => run(() => actions.deleteEvent(event.id), () => setConfirmDelete(null))}
                    >
                      تأكيد الحذف
                    </button>
                    <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(null)}>
                      تراجع
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        setForm({ kind: "edit", event });
                        setConfirmDelete(null);
                      }}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className={`${styles.linkBtn} ${styles.danger}`}
                      onClick={() => setConfirmDelete(event.id)}
                    >
                      حذف
                    </button>
                  </>
                ))}
            </div>
          )}
        </div>
        {showCountdown && (
          <span className={`${styles.countPill} ${days === 0 ? styles.today : days > 30 ? styles.soft : ""}`}>
            {countdownLabel(days)}
          </span>
        )}
      </div>
    );
  }

  // ---------- month grid ----------

  const blanks = weekday(monthStart);
  const cells = Array.from({ length: monthLength }, (_, i) => addDays(monthStart, i));
  const firstGreg = monthStart.split("-").map(Number);
  const lastGreg = monthEnd.split("-").map(Number);
  const gregRange =
    firstGreg[1] === lastGreg[1]
      ? `${GREGORIAN_MONTHS[firstGreg[1] - 1]} ${firstGreg[0]}`
      : firstGreg[0] === lastGreg[0]
        ? `${GREGORIAN_MONTHS[firstGreg[1] - 1]} – ${GREGORIAN_MONTHS[lastGreg[1] - 1]} ${lastGreg[0]}`
        : `${GREGORIAN_MONTHS[firstGreg[1] - 1]} ${firstGreg[0]} – ${GREGORIAN_MONTHS[lastGreg[1] - 1]} ${lastGreg[0]}`;

  const selectedItems = selectedDay ? monthItems.filter((i) => i.date === selectedDay) : [];
  const nextItem = upcoming[0];

  return (
    <div>
      {nextItem && <NextItemBanner item={nextItem} today={today} />}

      <div className={styles.layout}>
        {/* ---- month view ---- */}
        <div>
          <div className={styles.card}>
            <div className={styles.monthHead}>
              <button type="button" className={styles.navBtn} onClick={() => goToMonth(-1)} aria-label="الشهر السابق">
                →
              </button>
              <div className={styles.monthName}>
                <div className={styles.monthHijri}>
                  {HIJRI_MONTHS[month.month - 1]} {month.year} هـ
                </div>
                <div className={styles.monthGreg}>{gregRange}</div>
              </div>
              <button type="button" className={styles.navBtn} onClick={() => goToMonth(1)} aria-label="الشهر التالي">
                ←
              </button>
            </div>
            {!isCurrentMonth && (
              <button
                type="button"
                className={styles.todayBtn}
                onClick={() => {
                  setView(null);
                  setSelected(null);
                }}
              >
                العودة إلى الشهر الحالي
              </button>
            )}

            <div className={styles.weekdays}>
              {WEEKDAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className={styles.grid}>
              {Array.from({ length: blanks }, (_, i) => (
                <div key={`b${i}`} className={`${styles.cell} ${styles.blank}`} />
              ))}
              {cells.map((iso, i) => {
                const dayItems = monthItems.filter((it) => it.date === iso);
                const [, gm, gd] = iso.split("-").map(Number);
                const showMonth = gd === 1 || i === 0;
                return (
                  <button
                    type="button"
                    key={iso}
                    className={`${styles.cell} ${iso === today ? styles.isToday : ""} ${
                      iso === selectedDay ? styles.selected : ""
                    }`}
                    onClick={() => setSelected(iso)}
                    aria-label={`${hijriLabel({ ...month, day: i + 1 })}، ${gregorianLabel(iso)}${
                      dayItems.length ? `، ${dayItems.map(itemTitle).join("، ")}` : ""
                    }`}
                    aria-pressed={iso === selectedDay}
                  >
                    <span className={styles.cellHijri}>{i + 1}</span>
                    <span className={styles.cellGreg}>
                      {gd}
                      {showMonth && <span className={styles.cellGregMonth}> {GREGORIAN_MONTHS[gm - 1]}</span>}
                    </span>
                    {dayItems.length > 0 && (
                      <span className={styles.dots} aria-hidden>
                        {dayItems.some((it) => it.kind === "occasion") && <span className={styles.dotOccasion} />}
                        {dayItems.some((it) => it.kind === "event") && <span className={styles.dotEvent} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className={styles.legend}>
              <span>
                <span className={styles.dotOccasion} /> مناسبة
              </span>
              <span>
                <span className={styles.dotEvent} /> {w.eventLegend}
              </span>
            </div>

            <div className={styles.dayPanel}>
              {selectedDay ? (
                <>
                  <div className={styles.dayPanelHead}>
                    {hijriLabel(toHijri(selectedDay))} <span>· {gregorianLabelWithWeekday(selectedDay)}</span>
                  </div>
                  {selectedItems.length === 0 ? (
                    <div className={styles.muted}>{w.emptyDay}</div>
                  ) : (
                    <div className={styles.list}>
                      {selectedItems.map((item) => (
                        renderRow(item, item.date >= today)
                      ))}
                    </div>
                  )}
                  {canManage && !form && (
                    <button
                      type="button"
                      className={styles.linkBtn}
                      style={{ marginTop: 8 }}
                      onClick={() => setForm({ kind: "new", date: selectedDay })}
                    >
                      {w.addEventOnDay}
                    </button>
                  )}
                </>
              ) : (
                <div className={styles.muted}>
                  {imperative(viewerGender, { m: "اختر", f: "اختاري" })} يومًا من التقويم لعرض مناسباته.
                </div>
              )}
            </div>
          </div>

          {canManage && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>
                <span>
                  <span className={styles.dot} />
                  المناسبات الاختيارية
                </span>
              </div>
              <div className={styles.muted} style={{ marginBottom: 6 }}>
                {w.optionalIntro}
              </div>
              {OPTIONAL_OCCASIONS.map((o) => {
                const on = enabledOccasions.includes(o);
                const def = OCCASIONS[o];
                return (
                  <div key={o} className={styles.toggleRow}>
                    <div>
                      {def.name}
                      <small>
                        {def.day} {HIJRI_MONTHS[def.month - 1]}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={`${styles.switch} ${on ? styles.on : ""}`}
                      aria-pressed={on}
                      disabled={pending}
                      onClick={() => run(() => actions.setOptionalOccasion(o, !on))}
                    >
                      {on ? "مفعّلة" : "غير مفعّلة"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- lists ---- */}
        <div>
          {form && (
            <div className={styles.card}>
              <EventForm
                key={form.kind === "edit" ? form.event.id : `new-${form.date}`}
                heading={form.kind === "edit" ? w.editEvent : w.newEvent}
                initial={
                  form.kind === "edit"
                    ? {
                        title: form.event.title,
                        date: form.event.date,
                        description: form.event.description ?? "",
                      }
                    : { title: "", date: form.date, description: "" }
                }
                onSubmit={submitForm}
                onCancel={() => setForm(null)}
                titleRequired={w.titleRequired}
              />
            </div>
          )}

          {error && (
            <div className={styles.card} role="alert">
              <div className={styles.err} style={{ marginTop: 0 }}>
                {error}
              </div>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>
                <span className={styles.dot} />
                القادم
              </span>
              {canManage && !form && (
                <button type="button" className={styles.addBtn} onClick={() => setForm({ kind: "new", date: today })}>
                  {w.addEvent}
                </button>
              )}
            </div>
            <div className={styles.list}>
              {upcoming.map((item) => (
                renderRow(item, true)
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span>
                <span className={styles.dot} />
                {w.pastTitle}
              </span>
            </div>
            {past.length === 0 ? (
              <div className={styles.muted}>{w.pastEmpty}</div>
            ) : (
              <div className={styles.list}>
                {past.map((e) => (
                  renderRow({ kind: "event", key: e.id, event: e, date: e.date }, false)
                ))}
              </div>
            )}
          </div>

          <div className={styles.note}>
            التواريخ الهجرية محسوبة وفق تقويم أم القرى، وقد تختلف بيوم أو يومين بحسب رؤية الهلال.
            {canAdjust && w.adjustNote}
          </div>
        </div>
      </div>
    </div>
  );
}
