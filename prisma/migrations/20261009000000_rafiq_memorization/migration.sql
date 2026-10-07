-- «رفيق الحفظ» phase 2: plan, sessions and mistakes. Additive only: three
-- nullable columns on RafiqUser and three new Rafiq tables; no course table
-- or column changes.

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "planChangedAt" TIMESTAMP(3),
ADD COLUMN     "planTemplate" "PlanTemplate",
ADD COLUMN     "reviewReminderDays" INTEGER;

-- CreateTable
CREATE TABLE "RafiqPlanItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RafiqPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "RecitationSource" NOT NULL DEFAULT 'LOGGED',
    "type" "SessionType" NOT NULL DEFAULT 'NEW',
    "surahNumber" INTEGER NOT NULL,
    "fromAyah" INTEGER NOT NULL,
    "toAyah" INTEGER NOT NULL,
    "pagesCalculated" DECIMAL(7,3) NOT NULL,
    "quality" "RecitationQuality",
    "situation" "RecitationSituation",
    "reason" TEXT,
    "notes" TEXT,
    "day" DATE NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqMistake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "wordPosition" INTEGER NOT NULL,
    "wordText" TEXT NOT NULL,
    "type" "MistakeType" NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqMistake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RafiqPlanItem_userId_position_key" ON "RafiqPlanItem"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqPlanItem_userId_surahNumber_key" ON "RafiqPlanItem"("userId", "surahNumber");

-- CreateIndex
CREATE INDEX "RafiqSession_userId_occurredAt_idx" ON "RafiqSession"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "RafiqSession_userId_day_idx" ON "RafiqSession"("userId", "day");

-- CreateIndex
CREATE INDEX "RafiqMistake_userId_resolvedAt_idx" ON "RafiqMistake"("userId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqMistake_sessionId_surahNumber_ayah_wordPosition_key" ON "RafiqMistake"("sessionId", "surahNumber", "ayah", "wordPosition");

-- AddForeignKey
ALTER TABLE "RafiqPlanItem" ADD CONSTRAINT "RafiqPlanItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqSession" ADD CONSTRAINT "RafiqSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqMistake" ADD CONSTRAINT "RafiqMistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqMistake" ADD CONSTRAINT "RafiqMistake_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RafiqSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

