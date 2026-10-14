-- «الجدول اليومي», phase 3 (src/lib/tracker/schedule.ts, src/lib/prayer):
-- prayer-anchored times and weekday schedules. Additive only: a Prayer enum,
-- two nullable anchor columns on the three time tables and on template
-- items, and an optional place (city or custom coordinates, method, Asr
-- school) for courses and «رفيق الحفظ» users. Every new column is null by
-- default, so nothing changes for anyone who doesn't set a place or use
-- anchors; weekday schedules use the existing weekdays column.

-- CreateEnum
CREATE TYPE "Prayer" AS ENUM ('FAJR', 'SUNRISE', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "prayerAsr" TEXT,
ADD COLUMN     "prayerCityKey" TEXT,
ADD COLUMN     "prayerLat" DOUBLE PRECISION,
ADD COLUMN     "prayerLng" DOUBLE PRECISION,
ADD COLUMN     "prayerMethod" TEXT,
ADD COLUMN     "prayerPlace" TEXT;

-- AlterTable
ALTER TABLE "TrackerSlot" ADD COLUMN     "anchor" "Prayer",
ADD COLUMN     "anchorOffsetMin" INTEGER;

-- AlterTable
ALTER TABLE "TrackerStudentSlot" ADD COLUMN     "anchor" "Prayer",
ADD COLUMN     "anchorOffsetMin" INTEGER;

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "prayerAsr" TEXT,
ADD COLUMN     "prayerCityKey" TEXT,
ADD COLUMN     "prayerLat" DOUBLE PRECISION,
ADD COLUMN     "prayerLng" DOUBLE PRECISION,
ADD COLUMN     "prayerMethod" TEXT,
ADD COLUMN     "prayerPlace" TEXT;

-- AlterTable
ALTER TABLE "RafiqTrackerSlot" ADD COLUMN     "anchor" "Prayer",
ADD COLUMN     "anchorOffsetMin" INTEGER;

-- AlterTable
ALTER TABLE "TrackerTemplateItem" ADD COLUMN     "anchor" "Prayer",
ADD COLUMN     "anchorOffsetMin" INTEGER;

