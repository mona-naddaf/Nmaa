-- Home memorization log («حفظي في البيت»), phase 2. Purely additive: two new
-- tables, two enums, course settings (log off by default; targets 5/10/3),
-- and optional per-student target overrides (null = course default).
-- Nothing that derives a student's official position reads these tables.

-- CreateEnum
CREATE TYPE "HomeTapKind" AS ENUM ('LISTEN', 'REPEAT', 'RECITE');

-- CreateEnum
CREATE TYPE "HomeSegmentEnd" AS ENUM ('STUDENT', 'TEACHER_RECITED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "homeLogEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homeTargetListen" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "homeTargetRecite" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "homeTargetRepeat" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "homeTargetListen" INTEGER,
ADD COLUMN     "homeTargetRecite" INTEGER,
ADD COLUMN     "homeTargetRepeat" INTEGER;

-- CreateTable
CREATE TABLE "HomeSegment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "fromAyah" INTEGER NOT NULL,
    "toAyah" INTEGER NOT NULL,
    "targetListen" INTEGER NOT NULL,
    "targetRepeat" INTEGER NOT NULL,
    "targetRecite" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "finishedBy" "HomeSegmentEnd",

    CONSTRAINT "HomeSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeTap" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "ayah" INTEGER,
    "kind" "HomeTapKind" NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeTap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeSegment_studentId_finishedAt_idx" ON "HomeSegment"("studentId", "finishedAt");

-- CreateIndex
CREATE INDEX "HomeTap_segmentId_kind_ayah_idx" ON "HomeTap"("segmentId", "kind", "ayah");

-- CreateIndex
CREATE INDEX "HomeTap_studentId_day_idx" ON "HomeTap"("studentId", "day");

-- CreateIndex
CREATE INDEX "HomeTap_studentId_createdAt_idx" ON "HomeTap"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "HomeSegment" ADD CONSTRAINT "HomeSegment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeTap" ADD CONSTRAINT "HomeTap_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "HomeSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeTap" ADD CONSTRAINT "HomeTap_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------- rules Prisma can't express ----------

-- a segment is a real range inside one surah, at most 40 ayat
ALTER TABLE "HomeSegment" ADD CONSTRAINT "HomeSegment_range"
  CHECK ("surahNumber" BETWEEN 1 AND 114 AND "fromAyah" >= 1 AND "toAyah" >= "fromAyah" AND "toAyah" - "fromAyah" < 40);
ALTER TABLE "HomeSegment" ADD CONSTRAINT "HomeSegment_targets"
  CHECK ("targetListen" BETWEEN 1 AND 100 AND "targetRepeat" BETWEEN 1 AND 100 AND "targetRecite" BETWEEN 1 AND 100);
ALTER TABLE "Course" ADD CONSTRAINT "Course_home_targets"
  CHECK ("homeTargetListen" BETWEEN 1 AND 100 AND "homeTargetRepeat" BETWEEN 1 AND 100 AND "homeTargetRecite" BETWEEN 1 AND 100);
ALTER TABLE "Student" ADD CONSTRAINT "Student_home_targets"
  CHECK (("homeTargetListen" IS NULL OR "homeTargetListen" BETWEEN 1 AND 100)
     AND ("homeTargetRepeat" IS NULL OR "homeTargetRepeat" BETWEEN 1 AND 100)
     AND ("homeTargetRecite" IS NULL OR "homeTargetRecite" BETWEEN 1 AND 100));
-- a finished segment always says how it was finished
ALTER TABLE "HomeSegment" ADD CONSTRAINT "HomeSegment_finished_pair"
  CHECK (("finishedAt" IS NULL) = ("finishedBy" IS NULL));
