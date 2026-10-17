import { redirect } from "next/navigation";
import { requireFamilyChild } from "@/lib/family/child-session";
import { familyCalendarActor, familyCalendarData, familyCalendarWording } from "@/lib/family/calendar";
import { CalendarView } from "@/components/calendar/CalendarView";
import {
  createFamilyEventAction,
  deleteFamilyEventAction,
  setFamilyAdjustmentAction,
  setFamilyOccasionAction,
  updateFamilyEventAction,
} from "@/app/family/calendar-actions";
import hl from "@/components/home-log/home-log.module.css";

// «تقويم العائلة» for a child (step 6): her own family's, from her own
// session. She adds events and changes the ones she added; occasions and
// moon-sighting dates are the adults'.
export default async function ChildCalendarPage() {
  const child = await requireFamilyChild();
  const s = await familyCalendarActor(child.familyId);
  if ("error" in s) redirect("/family");
  const data = await familyCalendarData(s);
  const f = child.gender === "FEMALE";
  const id = s.familyId;
  return (
    <div>
      <div className={hl.sectionTitle} style={{ margin: "0 4px 6px" }}>
        <span style={{ fontSize: 17, color: "var(--ink)" }}>تقويم العائلة · {child.familyName}</span>
      </div>
      <p className={hl.muted} style={{ margin: "0 4px 12px" }}>
        هذا تقويم عائلتك، يراه الجميع. يمكنك أن {f ? "تضيفي" : "تضيف"} مناسبة، وأن {f ? "تعدّلي" : "تعدّل"} ما {f ? "أضفتِه" : "أضفتَه"} أو {f ? "تحذفيه" : "تحذفه"}.
      </p>
      <CalendarView
        enabledOccasions={data.enabledOccasions}
        adjustments={data.adjustments}
        events={data.events}
        canManage={false}
        canAddEvents
        canAdjust={false}
        viewerGender={child.gender}
        actions={{
          createEvent: createFamilyEventAction.bind(null, id),
          updateEvent: updateFamilyEventAction.bind(null, id),
          deleteEvent: deleteFamilyEventAction.bind(null, id),
          setOptionalOccasion: setFamilyOccasionAction.bind(null, id),
          setAdjustment: setFamilyAdjustmentAction.bind(null, id),
        }}
        wording={familyCalendarWording(false)}
      />
    </div>
  );
}
