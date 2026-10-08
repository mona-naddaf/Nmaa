-- Self-marked mistakes in home memorization (course students and «رفيق الحفظ»).
-- Additive only: one course setting (off by default) and two new tables;
-- no existing column changes. These tables are read only by their owner.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "homeMistakesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HomeMistake" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "wordPosition" INTEGER NOT NULL,
    "wordText" TEXT NOT NULL,
    "type" "MistakeType" NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "HomeMistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqHomeMistake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "wordPosition" INTEGER NOT NULL,
    "wordText" TEXT NOT NULL,
    "type" "MistakeType" NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RafiqHomeMistake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeMistake_studentId_resolvedAt_idx" ON "HomeMistake"("studentId", "resolvedAt");

-- CreateIndex
CREATE INDEX "RafiqHomeMistake_userId_resolvedAt_idx" ON "RafiqHomeMistake"("userId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "HomeMistake" ADD CONSTRAINT "HomeMistake_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqHomeMistake" ADD CONSTRAINT "RafiqHomeMistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one open mark per learner per word.
CREATE UNIQUE INDEX "HomeMistake_open_word" ON "HomeMistake"("studentId", "surahNumber", "ayah", "wordPosition")
  WHERE "resolvedAt" IS NULL;
CREATE UNIQUE INDEX "RafiqHomeMistake_open_word" ON "RafiqHomeMistake"("userId", "surahNumber", "ayah", "wordPosition")
  WHERE "resolvedAt" IS NULL;
