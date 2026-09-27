-- CreateEnum
CREATE TYPE "MistakeType" AS ENUM ('PRONUNCIATION', 'FORGOT_PROMPTED', 'HESITATED_SELF_CORRECTED');

-- CreateTable
CREATE TABLE "RecitationMistake" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "wordPosition" INTEGER NOT NULL,
    "wordText" TEXT NOT NULL,
    "type" "MistakeType" NOT NULL,
    "teacherId" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecitationMistake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecitationMistake_studentId_resolvedAt_idx" ON "RecitationMistake"("studentId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecitationMistake_sessionId_surahNumber_ayah_wordPosition_key" ON "RecitationMistake"("sessionId", "surahNumber", "ayah", "wordPosition");

-- AddForeignKey
ALTER TABLE "RecitationMistake" ADD CONSTRAINT "RecitationMistake_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationMistake" ADD CONSTRAINT "RecitationMistake_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecitationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationMistake" ADD CONSTRAINT "RecitationMistake_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationMistake" ADD CONSTRAINT "RecitationMistake_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

