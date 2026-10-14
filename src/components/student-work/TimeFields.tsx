"use client";

import { useState } from "react";
import work from "./work.module.css";
import { ScheduleEditor, type ScheduleInput } from "./ScheduleEditor";
import { scheduleModel, scheduleRows, type SlotRow } from "@/lib/tracker/schedule";
import { prayerMinutes, type PrayerLocation } from "@/lib/prayer/times";
import { useToday } from "@/lib/calendar/useToday";
import { useTimeZone } from "@/lib/time/TimeZoneProvider";

// An item's optional schedule in the add / edit forms («الجدول اليومي»):
// every day or per weekday, a clock time or a prayer anchor (with a place),
// or «بلا وقت» (lib/tracker/schedule.ts).

const asInput = (rows: SlotRow[]): ScheduleInput => {
  const m = scheduleModel(rows);
  return scheduleRows(m.base, m.days);
};

export function useTimeFields(initial: SlotRow[]) {
  const [start, setStart] = useState(initial);
  const [rows, setRows] = useState<ScheduleInput>(() => asInput(initial));
  const [valid, setValid] = useState(true);
  const [version, setVersion] = useState(0);
  return {
    start,
    version,
    set(r: ScheduleInput, ok: boolean) {
      setRows(r);
      setValid(ok);
    },
    /** The schedule to save, or what's wrong. */
    read(): { schedule: ScheduleInput } | { error: string } {
      return valid ? { schedule: rows } : { error: "يُرجى تصحيح الوقت قبل الحفظ" };
    },
    reset() {
      setStart([]);
      setRows([]);
      setValid(true);
      setVersion((v) => v + 1);
    },
  };
}

export function TimeFields({ fields, days, place }: { fields: ReturnType<typeof useTimeFields>; days: number; place: PrayerLocation | null }) {
  const today = useToday();
  const tz = useTimeZone();
  return (
    <div className={work.field}>
      <span className={work.fieldLabel}>الوقت (اختياري)</span>
      <ScheduleEditor
        key={fields.version}
        rows={fields.start}
        activeDays={days}
        anchors={place !== null}
        prayers={place && today ? prayerMinutes(place, today, tz) : null}
        onChange={fields.set}
      />
    </div>
  );
}
