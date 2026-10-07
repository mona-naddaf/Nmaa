-- «رفيق الحفظ» phase 4: commitment days and the follow-up tracker. Additive
-- only: three new Rafiq tables; no course table or column changes.

-- CreateTable
CREATE TABLE "RafiqCommitDays" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqCommitDays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqTrackerItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 127,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafiqTrackerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqTrackerCheck" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqTrackerCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RafiqCommitDays_userId_effectiveFrom_key" ON "RafiqCommitDays"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "RafiqTrackerItem_userId_archivedAt_idx" ON "RafiqTrackerItem"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "RafiqTrackerCheck_userId_day_idx" ON "RafiqTrackerCheck"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqTrackerCheck_itemId_day_key" ON "RafiqTrackerCheck"("itemId", "day");

-- AddForeignKey
ALTER TABLE "RafiqCommitDays" ADD CONSTRAINT "RafiqCommitDays_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqTrackerItem" ADD CONSTRAINT "RafiqTrackerItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqTrackerCheck" ADD CONSTRAINT "RafiqTrackerCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RafiqTrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqTrackerCheck" ADD CONSTRAINT "RafiqTrackerCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

