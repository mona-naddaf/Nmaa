-- A second memorization track per student (lib/recitation/tracks.ts).
-- Additive only: one enum, one table, and one nullable column with its
-- index and foreign key. Every existing session keeps trackId NULL (the
-- main plan) and means exactly what it meant before; no row is changed.

-- CreateEnum
CREATE TYPE "TrackKind" AS ENUM ('MUSHAF', 'REVERSE', 'FREE');

-- AlterTable
ALTER TABLE "RecitationSession" ADD COLUMN     "trackId" TEXT;

-- CreateTable
CREATE TABLE "StudentTrack" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "TrackKind" NOT NULL,
    "startSurah" INTEGER,
    "startAyah" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "StudentTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentTrack_studentId_idx" ON "StudentTrack"("studentId");

-- CreateIndex
CREATE INDEX "RecitationSession_trackId_idx" ON "RecitationSession"("trackId");

-- AddForeignKey
ALTER TABLE "StudentTrack" ADD CONSTRAINT "StudentTrack_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationSession" ADD CONSTRAINT "RecitationSession_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "StudentTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- at most one ACTIVE second track per student (ended ones are kept)
CREATE UNIQUE INDEX "StudentTrack_one_active_per_student" ON "StudentTrack"("studentId") WHERE "endedAt" IS NULL;
