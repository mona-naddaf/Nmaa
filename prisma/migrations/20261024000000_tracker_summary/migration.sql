-- «المحصّلات» (src/lib/tracker/summary.ts): two switches, both OFF by
-- default — a course's (for the student, her teachers and the parent) and a
-- «رفيق الحفظ» user's. Additive only: no existing row's data changes; the
-- summaries read the existing tracker history.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "trackerSummaryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "summaryEnabled" BOOLEAN NOT NULL DEFAULT false;

