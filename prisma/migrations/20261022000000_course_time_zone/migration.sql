-- «التوقيت»: the time zone each course counts its days in (src/lib/time/zone.ts).
-- Additive only: one column with a default, so every existing course (and
-- every new one) gets Asia/Riyadh and behaves exactly as before. No existing
-- row's data is changed; date-only values (attendance, points, …) keep
-- their meaning.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Riyadh';
