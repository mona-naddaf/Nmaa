// Teacher login names that are just a supervisor title — مشرف/مشرفة/مدير/مديرة,
// with or without "ال" and an optional "الدورة". A teacher logging in under one
// would either land on the supervisor's stand-in row or show up in the logs
// looking like the supervisor, so these are refused whatever the spelling.
// General titles (الأستاذة, المعلمة, ...) are deliberately not reserved, so
// real teachers' names are never blocked.

// tashkeel, superscript alef, tatweel, and invisible direction/joiner marks
const IGNORED = /[ً-ٰٟـ​-‏؜⁦-⁩﻿]/g;

const SUPERVISOR_TITLE = /^(ال)?(مشرف|مشرفه|مدير|مديره)(الدوره)?$/;

function normalize(name: string): string {
  return name
    .normalize("NFC")
    .replace(IGNORED, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "");
}

export function isReservedTeacherName(name: string): boolean {
  return SUPERVISOR_TITLE.test(normalize(name));
}

export const RESERVED_NAME_MESSAGE = "هذا الاسم محجوز، يُرجى إدخال اسمك الشخصي.";
