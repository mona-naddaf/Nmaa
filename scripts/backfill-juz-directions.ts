// One-time backfill: the juz direction of every «ترتيب المصحف بالعكس»
// student who already had sessions before directions existed
// (src/lib/recitation/juz-direction.ts, inferJuzDirections).
//
// Usage (the database URL is always explicit; nothing is read from .env):
//   JITI_ALIAS="{\"@/\":\"$(pwd -W)/src/\"}" node node_modules/jiti/lib/jiti-cli.mjs \
//     scripts/backfill-juz-directions.ts --url "<DATABASE_URL>" [--apply]
//
// Without --apply it is a dry run: SELECT queries only (it works before the
// migration too) and prints the report. With --apply it also inserts the
// decided directions as BACKFILL rows — never replacing an existing row, so
// a direction already decided (by an entry or by hand) is kept. Unclear and
// fully memorized juz get no row (they behave as «من آخره», as before).
//
// «من أوله» is recorded only where it was reviewed and is clear
// (FROM_START_APPROVED); every other «من أوله» inference stays undecided,
// exactly as today, and is listed in the report so it can be set by hand
// from the student page. --apply refuses unless each approved case is found
// exactly once.

import { PrismaClient } from "@prisma/client";
import { SURAH_NAME } from "@/lib/quran-data";
import { juzGroupSurahs } from "@/lib/quran-data/juz";
import {
  JUZ_DIRECTION_LABEL,
  inferJuzDirections,
  isStockReverse,
  reverseOrder,
  type InferredJuz,
  type JuzDirections,
} from "@/lib/recitation/juz-direction";
import { deriveCurrentPosition, deriveReach, nextExpectedEntry, type PlanPosition } from "@/lib/recitation/logic";

const args = process.argv.slice(2);
const url = args[args.indexOf("--url") + 1];
const apply = args.includes("--apply");
if (!args.includes("--url") || !url || url.startsWith("--")) {
  console.error("usage: … scripts/backfill-juz-directions.ts --url <DATABASE_URL> [--apply]");
  process.exit(1);
}
const host = new URL(url).hostname;
const prisma = new PrismaClient({ datasourceUrl: url });

const BASIS_LABEL: Record<InferredJuz["basis"], string> = {
  coverage: "من المحفوظ",
  "first-entry": "من أول تسميع",
  unclear: "غير واضح",
  complete: "مكتمل",
};

// student name → juz; reviewed on the live dry run of 2026-10-11
const FROM_START_APPROVED: Record<string, number> = {
  "جود أبو زيد": 30,
  "رزان العلواني": 29,
};

const where = (p: PlanPosition | null) => (p ? `${SURAH_NAME[p.surahNumber]} ${p.ayah}` : "لم تبدأ");

async function main() {
  console.log(`${apply ? "APPLY" : "DRY RUN (SELECT only)"} on ${host}\n`);

  // the table exists only once the migration is applied
  const [{ exists }] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'StudentJuzDirection') AS "exists"`;
  if (apply && !exists) throw new Error("the migration is not applied on this database");

  const courses = await prisma.course.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const students = await prisma.student.findMany({
    where: { planTemplate: "MUSHAF_REVERSE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      courseId: true,
      archivedAt: true,
      planTemplate: true,
      planItems: { orderBy: { position: "asc" }, select: { surahNumber: true } },
      recitationSessions: {
        select: { surahNumber: true, fromAyah: true, toAyah: true, type: true, source: true, situation: true, reason: true, occurredAt: true },
      },
    },
  });
  const existing = exists
    ? await prisma.$queryRaw<{ studentId: string; juz: number }[]>`SELECT "studentId", "juz" FROM "StudentJuzDirection"`
    : [];
  const decidedAlready = new Set(existing.map((e) => `${e.studentId}:${e.juz}`));

  const rows: { studentId: string; juz: number; direction: "FROM_START" | "FROM_END" }[] = [];
  const unclear: string[] = [];
  const heldBack: string[] = [];
  const approvedFound = new Map<string, number>();
  const changed: string[] = [];

  for (const course of courses) {
    const list = students.filter((s) => s.courseId === course.id);
    if (list.length === 0) continue;
    const tally = { students: list.length, archived: 0, edited: 0, noSessions: 0, start: 0, end: 0, unclear: 0, heldBack: 0, complete: 0, kept: 0 };
    const byBasis = new Map<string, number>();

    for (const s of list) {
      if (s.archivedAt) tally.archived++;
      const stored = s.planItems.map((p) => p.surahNumber);
      if (!isStockReverse(s.planTemplate, stored)) {
        tally.edited++;
        continue;
      }
      if (s.recitationSessions.length === 0) {
        tally.noSessions++;
        continue;
      }
      const inferred = inferJuzDirections(s.recitationSessions);
      const directions: JuzDirections = {};
      for (const j of inferred) {
        const key = `${j.basis}:${j.direction ?? "-"}`;
        byBasis.set(key, (byBasis.get(key) ?? 0) + 1);
        if (j.basis === "complete") tally.complete++;
        else if (!j.direction) {
          tally.unclear++;
          const surahs = juzGroupSurahs(j.juz);
          const covered = surahs.filter((n) => s.recitationSessions.some((x) => x.type === "NEW" && x.surahNumber === n)).map((n) => SURAH_NAME[n]);
          unclear.push(
            `${course.name} · ${s.name}${s.archivedAt ? " (أرشيف)" : ""} · الجزء ${j.juz}: ` +
              `أول تسميع ${j.firstEntry ? `${SURAH_NAME[j.firstEntry.surahNumber]} ${j.firstEntry.fromAyah}` : "— (حفظ سابق فقط)"}؛ ` +
              `سور فيها حفظ: ${covered.join("، ")}`,
          );
        } else if (decidedAlready.has(`${s.id}:${j.juz}`)) {
          tally.kept++;
          if (FROM_START_APPROVED[s.name] === j.juz) approvedFound.set(s.name, (approvedFound.get(s.name) ?? 0) + 1);
        } else if (j.direction === "FROM_START" && FROM_START_APPROVED[s.name] !== j.juz) {
          tally.heldBack++;
          heldBack.push(`${course.name} · ${s.name}${s.archivedAt ? " (أرشيف)" : ""} · الجزء ${j.juz} (${BASIS_LABEL[j.basis]})`);
        } else {
          if (j.direction === "FROM_START") approvedFound.set(s.name, (approvedFound.get(s.name) ?? 0) + 1);
          tally[j.direction === "FROM_START" ? "start" : "end"]++;
          directions[j.juz] = j.direction;
          rows.push({ studentId: s.id, juz: j.juz, direction: j.direction });
        }
      }

      // what the backfill changes for her: position and next pre-fill, old order vs new
      const sessions = s.recitationSessions;
      const before = deriveCurrentPosition(stored, deriveReach(stored, sessions));
      const plan = reverseOrder(directions);
      const after = deriveCurrentPosition(plan, deriveReach(plan, sessions));
      const nb = nextExpectedEntry(stored, before);
      const na = nextExpectedEntry(plan, after);
      if (where(before) !== where(after) || nb.surahNumber !== na.surahNumber || nb.fromAyah !== na.fromAyah) {
        const dirs = Object.entries(directions)
          .map(([j, d]) => `ج${j}: ${JUZ_DIRECTION_LABEL[d!]}`)
          .join("، ");
        changed.push(
          `${course.name} · ${s.name} [${dirs}]: الموضع ${where(before)} ← ${where(after)}؛ ` +
            `التسميع التالي ${SURAH_NAME[nb.surahNumber]} ${nb.fromAyah} ← ${SURAH_NAME[na.surahNumber]} ${na.fromAyah}`,
        );
      }
    }

    console.log(`■ ${course.name}`);
    console.log(
      `  طلاب «بالعكس»: ${tally.students} (منهم في الأرشيف ${tally.archived}) · مرتّبة يدويًا (تُعامل مخصّصة، لا تُمسّ): ${tally.edited} · بلا تسميع: ${tally.noSessions}`,
    );
    console.log(
      `  أجزاء تُسجَّل: من أوله ${tally.start} · من آخره ${tally.end} · «من أوله» غير معتمد (لا يُسجَّل) ${tally.heldBack} · غير واضح (لا يُسجَّل) ${tally.unclear} · مكتمل (لا يُسجَّل) ${tally.complete} · محدَّد مسبقًا (يُترك) ${tally.kept}`,
    );
    console.log(
      `  حسب الأساس: ${[...byBasis]
        .map(([k, n]) => {
          const [basis, dir] = k.split(":");
          return `${BASIS_LABEL[basis as InferredJuz["basis"]]}${dir !== "-" ? `/${JUZ_DIRECTION_LABEL[dir as "FROM_START"]}` : ""}=${n}`;
        })
        .join(" · ") || "—"}\n`,
    );
  }

  console.log(`حالات غير واضحة (${unclear.length}) — تبقى بلا اتجاه وتُعامل «من آخره» كما الآن:`);
  for (const u of unclear) console.log(`  - ${u}`);
  console.log(`\n«من أوله» غير معتمد (${heldBack.length}) — يبقى بلا اتجاه ويُعامل «من آخره» كما الآن، ويُضبط يدويًا عند الحاجة:`);
  for (const h of heldBack) console.log(`  - ${h}`);
  const missing = Object.keys(FROM_START_APPROVED).filter((name) => approvedFound.get(name) !== 1);
  console.log(
    `\n«من أوله» المعتمد: ${Object.entries(FROM_START_APPROVED)
      .map(([name, juz]) => `${name} ج${juz} ${approvedFound.get(name) === 1 ? "✓" : `✗ (وُجد ${approvedFound.get(name) ?? 0})`}`)
      .join(" · ")}`,
  );
  console.log(`\nطلاب يتغيّر موضعهم أو تسميعهم التالي بعد التعبئة (${changed.length}):`);
  for (const c of changed) console.log(`  - ${c}`);
  console.log(`\nالمجموع: ${rows.length} صفًا (BACKFILL).`);

  if (apply && missing.length > 0) throw new Error(`approved «من أوله» not found exactly once: ${missing.join(", ")}`);
  if (apply && rows.length > 0) {
    const { count } = await prisma.studentJuzDirection.createMany({
      data: rows.map((r) => ({ ...r, source: "BACKFILL" as const })),
      skipDuplicates: true,
    });
    console.log(`أُدرج ${count} صفًا.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
