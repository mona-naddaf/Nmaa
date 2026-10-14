-- «الجدول اليومي» for «جدول المتابعة», phase 1 (src/lib/tracker/agenda.ts):
-- item order and clock times, for course students and «رفيق الحفظ».
-- Additive only: new columns with defaults (both feature switches start
-- OFF; sortOrder 0 keeps the existing creation order) and four new tables.
-- No existing row's data changes; ticks and scores are untouched.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "trackerAgendaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TrackerItem" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "agendaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RafiqTrackerItem" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TrackerTemplateItem" ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "startMin" INTEGER;

-- CreateTable
CREATE TABLE "TrackerSlot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "weekdays" INTEGER NOT NULL DEFAULT 127,
    "startMin" INTEGER,
    "durationMin" INTEGER,

    CONSTRAINT "TrackerSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerStudentSlot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekdays" INTEGER NOT NULL DEFAULT 127,
    "startMin" INTEGER,
    "durationMin" INTEGER,

    CONSTRAINT "TrackerStudentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerStudentOrder" (
    "studentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TrackerStudentOrder_pkey" PRIMARY KEY ("studentId","itemId")
);

-- CreateTable
CREATE TABLE "RafiqTrackerSlot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekdays" INTEGER NOT NULL DEFAULT 127,
    "startMin" INTEGER,
    "durationMin" INTEGER,

    CONSTRAINT "RafiqTrackerSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackerSlot_itemId_weekdays_key" ON "TrackerSlot"("itemId", "weekdays");

-- CreateIndex
CREATE INDEX "TrackerStudentSlot_studentId_idx" ON "TrackerStudentSlot"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerStudentSlot_itemId_studentId_weekdays_key" ON "TrackerStudentSlot"("itemId", "studentId", "weekdays");

-- CreateIndex
CREATE INDEX "RafiqTrackerSlot_userId_idx" ON "RafiqTrackerSlot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqTrackerSlot_itemId_weekdays_key" ON "RafiqTrackerSlot"("itemId", "weekdays");

-- AddForeignKey
ALTER TABLE "TrackerSlot" ADD CONSTRAINT "TrackerSlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerStudentSlot" ADD CONSTRAINT "TrackerStudentSlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerStudentSlot" ADD CONSTRAINT "TrackerStudentSlot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerStudentOrder" ADD CONSTRAINT "TrackerStudentOrder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerStudentOrder" ADD CONSTRAINT "TrackerStudentOrder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqTrackerSlot" ADD CONSTRAINT "RafiqTrackerSlot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RafiqTrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqTrackerSlot" ADD CONSTRAINT "RafiqTrackerSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

