import Link from "next/link";
import { redirect } from "next/navigation";
import { familyEnabled } from "@/lib/family/enabled";
import { familyAccess } from "@/lib/family/data";
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

// «تقويم العائلة» for an adult of the family (step 6): everyone adds events
// and changes her own; an adult with edit rights changes anyone's, the
// optional occasions and the moon-sighting dates. Her own Rafiq calendar
// (/rafiq/calendar) stays separate.
export default async function FamilyCalendarPage({ params }: PageProps<"/rafiq/family/[familyId]/calendar">) {
  if (!familyEnabled()) redirect("/rafiq");
  const { familyId } = await params;
  const access = await familyAccess(familyId);
  if ("error" in access) redirect("/rafiq/family?list=1");
  const s = await familyCalendarActor(access.family.id);
  if ("error" in s) redirect("/rafiq/family?list=1");
  const data = await familyCalendarData(s);
  const editor = s.actor.canEdit;
  const f = s.gender === "FEMALE";
  const id = s.familyId;
  return (
    <div>
      <div className={hl.sectionTitle} style={{ margin: "0 4px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 17, color: "var(--ink)" }}>تقويم العائلة · {access.family.name}</span>
        <Link href={`/rafiq/family/${id}`} className={hl.linkBtn}>
          العائلة ←
        </Link>
      </div>
      <p className={hl.muted} style={{ margin: "0 4px 12px" }}>
        يرى هذا التقويمَ كلُّ أفراد العائلة، الكبار والأطفال، ويمكن لكلٍّ منهم أن يضيف مناسبة.{" "}
        {editor ? `${f ? "تستطيعين" : "تستطيع"} تعديل أي مناسبة وحذفها، واختيار المناسبات الاختيارية وتعديل المواعيد بحسب رؤية الهلال.` : `${f ? "تستطيعين" : "تستطيع"} تعديل ما ${f ? "أضفتِه" : "أضفتَه"} فقط.`} تقويمك في «رفيق الحفظ» منفصل عنه.
      </p>
      <CalendarView
        enabledOccasions={data.enabledOccasions}
        adjustments={data.adjustments}
        events={data.events}
        canManage={editor}
        canAddEvents
        canAdjust={editor}
        viewerGender={s.gender}
        actions={{
          createEvent: createFamilyEventAction.bind(null, id),
          updateEvent: updateFamilyEventAction.bind(null, id),
          deleteEvent: deleteFamilyEventAction.bind(null, id),
          setOptionalOccasion: setFamilyOccasionAction.bind(null, id),
          setAdjustment: setFamilyAdjustmentAction.bind(null, id),
        }}
        wording={familyCalendarWording(editor)}
      />
    </div>
  );
}
