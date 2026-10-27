-- «أيام العذر» (src/lib/excuse). Additive only: every new switch is off,
-- every item keeps «يُحسب كالمعتاد» (NONE), no excuse rows exist — nothing
-- changes until a course, a woman or a girl's family turns it on. Undo with
-- prisma/rollback/20261031_excuse_down.sql.

-- CreateEnum
CREATE TYPE "ExcuseMode" AS ENUM ('NONE', 'SKIP', 'ALT');

-- CreateEnum
CREATE TYPE "ExcuseActor" AS ENUM ('SELF', 'STAFF', 'ADULT', 'AUTO');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'EXCUSED';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "excuseEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "excuseParentVisible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TrackerItem" ADD COLUMN     "excuseAltTitle" TEXT,
ADD COLUMN     "excuseMode" "ExcuseMode" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "excuseEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RafiqTrackerItem" ADD COLUMN     "excuseAltTitle" TEXT,
ADD COLUMN     "excuseMode" "ExcuseMode" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "StudentExcuse" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startDay" DATE NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endDay" DATE,
    "endMin" INTEGER,
    "keepOriginal" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keepExcused" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedBy" "ExcuseActor" NOT NULL,
    "startedByTeacherId" TEXT,
    "endedBy" "ExcuseActor",
    "endedByTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExcuse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqExcuse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDay" DATE NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endDay" DATE,
    "endMin" INTEGER,
    "keepOriginal" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keepExcused" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedBy" "ExcuseActor" NOT NULL,
    "startedById" TEXT,
    "endedBy" "ExcuseActor",
    "endedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafiqExcuse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqExcusePause" (
    "id" TEXT NOT NULL,
    "excuseId" TEXT NOT NULL,
    "fromDay" DATE NOT NULL,
    "toDay" DATE,

    CONSTRAINT "RafiqExcusePause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyExcuseViewer" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "adultId" TEXT NOT NULL,
    "canSee" BOOLEAN NOT NULL,

    CONSTRAINT "FamilyExcuseViewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentExcuse_studentId_startDay_idx" ON "StudentExcuse"("studentId", "startDay");

-- CreateIndex
CREATE INDEX "RafiqExcuse_userId_startDay_idx" ON "RafiqExcuse"("userId", "startDay");

-- CreateIndex
CREATE INDEX "RafiqExcusePause_excuseId_idx" ON "RafiqExcusePause"("excuseId");

-- CreateIndex
CREATE INDEX "FamilyExcuseViewer_adultId_idx" ON "FamilyExcuseViewer"("adultId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyExcuseViewer_childId_adultId_key" ON "FamilyExcuseViewer"("childId", "adultId");

-- AddForeignKey
ALTER TABLE "StudentExcuse" ADD CONSTRAINT "StudentExcuse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExcuse" ADD CONSTRAINT "StudentExcuse_startedByTeacherId_fkey" FOREIGN KEY ("startedByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExcuse" ADD CONSTRAINT "StudentExcuse_endedByTeacherId_fkey" FOREIGN KEY ("endedByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqExcuse" ADD CONSTRAINT "RafiqExcuse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqExcuse" ADD CONSTRAINT "RafiqExcuse_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqExcuse" ADD CONSTRAINT "RafiqExcuse_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqExcusePause" ADD CONSTRAINT "RafiqExcusePause_excuseId_fkey" FOREIGN KEY ("excuseId") REFERENCES "RafiqExcuse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyExcuseViewer" ADD CONSTRAINT "FamilyExcuseViewer_childId_fkey" FOREIGN KEY ("childId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyExcuseViewer" ADD CONSTRAINT "FamilyExcuseViewer_adultId_fkey" FOREIGN KEY ("adultId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one open excuse per person, and one open pause per excuse
CREATE UNIQUE INDEX "StudentExcuse_one_open_per_student" ON "StudentExcuse"("studentId") WHERE "endDay" IS NULL;
CREATE UNIQUE INDEX "RafiqExcuse_one_open_per_user" ON "RafiqExcuse"("userId") WHERE "endDay" IS NULL;
CREATE UNIQUE INDEX "RafiqExcusePause_one_open_per_excuse" ON "RafiqExcusePause"("excuseId") WHERE "toDay" IS NULL;

-- A minute of the day; an end is all there or not at all, and comes after the start
ALTER TABLE "StudentExcuse" ADD CONSTRAINT "StudentExcuse_shape_check" CHECK (
  "startMin" BETWEEN 0 AND 1439
  AND (("endDay" IS NULL AND "endMin" IS NULL AND "endedBy" IS NULL)
    OR ("endDay" IS NOT NULL AND "endMin" BETWEEN 0 AND 1439 AND "endedBy" IS NOT NULL
      AND ("endDay", "endMin") > ("startDay", "startMin")))
);
ALTER TABLE "RafiqExcuse" ADD CONSTRAINT "RafiqExcuse_shape_check" CHECK (
  "startMin" BETWEEN 0 AND 1439
  AND (("endDay" IS NULL AND "endMin" IS NULL AND "endedBy" IS NULL)
    OR ("endDay" IS NOT NULL AND "endMin" BETWEEN 0 AND 1439 AND "endedBy" IS NOT NULL
      AND ("endDay", "endMin") > ("startDay", "startMin")))
);
ALTER TABLE "RafiqExcusePause" ADD CONSTRAINT "RafiqExcusePause_days_check" CHECK ("toDay" IS NULL OR "toDay" >= "fromDay");

-- An alternative has a title; the title is at most 60 characters
ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_excuse_alt_check" CHECK (
  ("excuseMode" = 'ALT') = ("excuseAltTitle" IS NOT NULL) AND char_length("excuseAltTitle") <= 60
);
ALTER TABLE "RafiqTrackerItem" ADD CONSTRAINT "RafiqTrackerItem_excuse_alt_check" CHECK (
  ("excuseMode" = 'ALT') = ("excuseAltTitle" IS NOT NULL) AND char_length("excuseAltTitle") <= 60
);
