-- Islamic calendar. Purely additive: new enums, new Course columns that all
-- default to "off", and two new tables. No existing row changes meaning.

-- CreateEnum
CREATE TYPE "CalendarEditPermission" AS ENUM ('ADMIN_ONLY', 'ALL_TEACHERS');

-- CreateEnum
CREATE TYPE "Occasion" AS ENUM ('RAMADAN_START', 'EID_FITR', 'ARAFAH', 'EID_ADHA', 'HIJRI_NEW_YEAR', 'ASHURA', 'ISRA_MIRAJ', 'MID_SHABAN');

-- AlterTable: every existing course starts with the calendar off, the banner
-- off, supervisor-only editing, and no optional occasions enabled
ALTER TABLE "Course" ADD COLUMN     "calendarBannerEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calendarEditPermission" "CalendarEditPermission" NOT NULL DEFAULT 'ADMIN_ONLY',
ADD COLUMN     "calendarEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enabledOccasions" "Occasion"[] DEFAULT ARRAY[]::"Occasion"[];

-- CreateTable
CREATE TABLE "CalendarAdjustment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "occasion" "Occasion" NOT NULL,
    "hijriYear" INTEGER NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "createdByTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarAdjustment_courseId_occasion_hijriYear_key" ON "CalendarAdjustment"("courseId", "occasion", "hijriYear");

-- CreateIndex
CREATE INDEX "CalendarEvent_courseId_date_idx" ON "CalendarEvent"("courseId", "date");

-- AddForeignKey
ALTER TABLE "CalendarAdjustment" ADD CONSTRAINT "CalendarAdjustment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: deleting a teacher keeps her events; they become
-- supervisor-owned (createdByTeacherId null = created by the supervisor)
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An adjustment is only ever ±1 or ±2 days; "no adjustment" is no row.
-- (Not expressible in the Prisma schema, so it lives here; Prisma leaves
-- CHECK constraints alone.)
ALTER TABLE "CalendarAdjustment" ADD CONSTRAINT "CalendarAdjustment_offset_range"
  CHECK ("offsetDays" IN (-2, -1, 1, 2));

-- A custom event must have a real title.
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_title_not_blank"
  CHECK (length(btrim("title")) > 0);
