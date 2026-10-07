import { prisma } from "@/lib/db";
import { requireRafiqUser } from "@/lib/rafiq/session";
import { CalendarView, type CalendarWording } from "@/components/calendar/CalendarView";
import { createDayAction, deleteDayAction, setAdjustmentAction, setOptionalOccasionAction, updateDayAction } from "./actions";

// Her calendar: the same Hijri + Gregorian calendar as a course's, with the
// main occasions always shown, optional ones she turns on, her own personal
// days, and her own moon-sighting adjustments.

const WORDING: CalendarWording = {
  eventLegend: "يوم خاص",
  addEventOnDay: "+ إضافة يوم خاص في هذا اليوم",
  addEvent: "+ إضافة يوم خاص",
  newEvent: "يوم خاص جديد",
  editEvent: "تعديل اليوم الخاص",
  confirmDeleteEvent: "حذف هذا اليوم الخاص نهائيًا؟",
  emptyDay: "لا توجد مناسبات أو أيام خاصة في هذا اليوم.",
  optionalIntro: "تظهر المناسبات الأساسية (رمضان، والعيدان، ويوم عرفة) دائمًا. ويمكن إضافة ما يلي إلى تقويمك:",
  pastTitle: "أيامي الخاصة السابقة",
  pastEmpty: "لا توجد أيام خاصة سابقة.",
  adjustNote: " يمكن تعديل موعد أي مناسبة للعام الحالي والقادم من قائمة القادم أو من يومها في التقويم.",
  titleRequired: "يُرجى إدخال عنوان اليوم الخاص",
};

export default async function RafiqCalendarPage() {
  const user = await requireRafiqUser();
  const [settings, adjustments, days] = await Promise.all([
    prisma.rafiqUser.findUniqueOrThrow({ where: { id: user.id }, select: { enabledOccasions: true } }),
    prisma.rafiqCalendarAdjustment.findMany({ where: { userId: user.id }, select: { occasion: true, hijriYear: true, offsetDays: true } }),
    prisma.rafiqCalendarDay.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      select: { id: true, title: true, description: true, date: true },
    }),
  ]);
  return (
    <CalendarView
      enabledOccasions={settings.enabledOccasions}
      adjustments={adjustments}
      events={days.map((d) => ({ id: d.id, title: d.title, description: d.description, date: d.date.toISOString().slice(0, 10), editable: true }))}
      canManage
      canAdjust
      viewerGender={user.gender}
      actions={{
        createEvent: createDayAction,
        updateEvent: updateDayAction,
        deleteEvent: deleteDayAction,
        setOptionalOccasion: setOptionalOccasionAction,
        setAdjustment: setAdjustmentAction,
      }}
      wording={WORDING}
    />
  );
}
