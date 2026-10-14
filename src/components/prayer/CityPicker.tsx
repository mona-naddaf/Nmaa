"use client";

import { useState, useTransition } from "react";
import hl from "@/components/home-log/home-log.module.css";
import work from "@/components/student-work/work.module.css";
import { CITIES, COUNTRIES, cityByKey, type City } from "@/lib/prayer/cities";
import {
  ASR_LABEL,
  defaultMethod,
  METHOD_LABEL,
  METHODS,
  PRAYERS,
  PRAYER_NAME,
  prayerMinutes,
  type AsrSchool,
  type MethodKey,
  type PrayerLocation,
} from "@/lib/prayer/times";
import { clockLabel } from "@/lib/tracker/agenda";
import { zoneToday } from "@/lib/time/zone";

// The place for prayer times (a course's or a «رفيق الحفظ» user's): a city
// from the curated list or «موقع مخصّص» (name + coordinates), the
// calculation method (the country's default, overridable) and the Asr
// school. Shows today's times before saving. Optional: «إزالة المدينة».

const MAX_RESULTS = 20;
const norm = (s: string) => s.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();

export function CityPicker({
  initial,
  previewZone,
  intro,
  onSave,
  onCity,
}: {
  initial: PrayerLocation | null;
  // the zone today's preview is shown in (a course's); null: the city's own, or the browser's
  previewZone: string | null;
  intro: string;
  onSave: (loc: PrayerLocation | null) => Promise<{ error?: string }>;
  // a city was chosen (a course preselects its time zone)
  onCity?: (city: City) => void;
}) {
  const [current, setCurrent] = useState(initial);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<PrayerLocation | null>(initial);
  const [lat, setLat] = useState(initial ? String(initial.lat) : "");
  const [lng, setLng] = useState(initial ? String(initial.lng) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const q = norm(query);
  const results = q ? CITIES.filter((c) => norm(c.name).includes(q) || norm(COUNTRIES[c.country] ?? "").includes(q) || c.key.includes(q)).slice(0, MAX_RESULTS) : [];

  function choose(c: City) {
    setCustom(false);
    setDraft({ key: c.key, name: c.name, lat: c.lat, lng: c.lng, method: defaultMethod(c.country), asr: draft?.asr ?? "SHAFI" });
    setQuery("");
    onCity?.(c);
  }

  function save(loc: PrayerLocation | null) {
    setMsg(null);
    startTransition(async () => {
      const r = await onSave(loc);
      if (r.error) return setMsg({ ok: false, text: r.error });
      setCurrent(loc);
      setOpen(false);
      setMsg({ ok: true, text: loc ? "تم حفظ المدينة ✓" : "أُزيلت المدينة ✓" });
    });
  }

  // the draft with the custom coordinates typed so far
  const effective: PrayerLocation | null = custom
    ? draft && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat.trim() && lng.trim()
      ? { ...draft, key: null, lat: Number(lat), lng: Number(lng) }
      : null
    : draft;
  const zone = previewZone ?? (effective?.key ? (cityByKey(effective.key)?.tz ?? null) : null);
  let preview: Record<string, number> | null = null;
  try {
    preview = effective ? prayerMinutes(effective, zone ? zoneToday(zone) : zoneToday(Intl.DateTimeFormat().resolvedOptions().timeZone), zone) : null;
  } catch {
    preview = null;
  }

  return (
    <div>
      <p className={hl.muted} style={{ marginTop: 0 }}>
        {intro}
      </p>
      <div style={{ fontSize: 14, marginBottom: 10 }}>
        المدينة: <b>{current ? current.name : "لم تُحدَّد"}</b>
        {current && ` — ${METHOD_LABEL[current.method]}، العصر: ${ASR_LABEL[current.asr]}`}
      </div>
      {msg && <div className={msg.ok ? hl.ok : hl.err}>{msg.text}</div>}
      {!open ? (
        <div className={hl.actionsRow}>
          <button type="button" className={hl.ghostBtn} onClick={() => setOpen(true)}>
            {current ? "تغيير المدينة" : "تحديد المدينة"}
          </button>
          {current && (
            <button type="button" className={work.dangerBtn} disabled={pending} onClick={() => save(null)}>
              إزالة المدينة
            </button>
          )}
        </div>
      ) : (
        <div className={hl.section} style={{ marginBottom: 0 }}>
          {!custom && (
            <div className={work.field}>
              <label htmlFor="city-search">ابحث عن مدينة</label>
              <input id="city-search" className={work.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="مثال: الرياض، القاهرة، لندن" />
              {results.length > 0 && (
                <div className={work.pills} style={{ marginTop: 8 }}>
                  {results.map((c) => (
                    <button key={c.key} type="button" className={`${work.pill} ${draft?.key === c.key ? work.sel : ""}`} onClick={() => choose(c)}>
                      {c.name}، {COUNTRIES[c.country]}
                    </button>
                  ))}
                </div>
              )}
              {q && results.length === 0 && <div className={work.hint}>لا توجد مدينة بهذا الاسم في القائمة — يمكن استخدام «موقع مخصّص».</div>}
            </div>
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, margin: "6px 0 10px" }}>
            <input
              type="checkbox"
              checked={custom}
              onChange={(e) => {
                setCustom(e.target.checked);
                if (e.target.checked) setDraft({ key: null, name: draft?.name ?? "", lat: 0, lng: 0, method: draft?.method ?? "MWL", asr: draft?.asr ?? "SHAFI" });
              }}
            />
            موقع مخصّص (الاسم والإحداثيات)
          </label>
          {custom && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className={work.field}>
                <label htmlFor="place-name">الاسم</label>
                <input id="place-name" className={work.input} value={draft?.name ?? ""} maxLength={60} onChange={(e) => draft && setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className={work.field}>
                <label htmlFor="place-lat">خط العرض</label>
                <input id="place-lat" className={work.input} dir="ltr" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="24.7136" style={{ maxWidth: 140 }} />
              </div>
              <div className={work.field}>
                <label htmlFor="place-lng">خط الطول</label>
                <input id="place-lng" className={work.input} dir="ltr" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="46.6753" style={{ maxWidth: 140 }} />
              </div>
            </div>
          )}
          {draft && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className={work.field}>
                <label htmlFor="place-method">طريقة الحساب</label>
                <select id="place-method" className={work.input} value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as MethodKey })}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={work.field}>
                <label htmlFor="place-asr">العصر</label>
                <select id="place-asr" className={work.input} value={draft.asr} onChange={(e) => setDraft({ ...draft, asr: e.target.value as AsrSchool })}>
                  {(Object.keys(ASR_LABEL) as AsrSchool[]).map((a) => (
                    <option key={a} value={a}>
                      {ASR_LABEL[a]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {preview && (
            <div className={work.hint} style={{ marginBottom: 8 }}>
              مواقيت اليوم: {PRAYERS.map((p) => `${PRAYER_NAME[p]} ${clockLabel(preview![p])}`).join(" · ")}
            </div>
          )}
          <div className={hl.actionsRow}>
            <button type="button" className={hl.primaryBtn} disabled={pending || !effective || !effective.name.trim()} onClick={() => effective && save(effective)}>
              {pending ? "جارٍ الحفظ…" : "حفظ المدينة"}
            </button>
            <button
              type="button"
              className={hl.ghostBtn}
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setDraft(current);
                setCustom(false);
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
