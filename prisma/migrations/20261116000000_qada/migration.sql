-- «القضاء» (src/lib/qada). Additive only: two new tables (empty), four new
-- types, and a switch that is off for everyone, so nothing changes until
-- someone turns it on. Undo with prisma/rollback/20261116_qada_down.sql.

-- CreateEnum
CREATE TYPE "QadaKind" AS ENUM ('FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA', 'FAST');

-- CreateEnum
CREATE TYPE "QadaAction" AS ENUM ('OWED', 'MADE_UP');

-- CreateEnum
CREATE TYPE "QadaSource" AS ENUM ('MANUAL', 'ESTIMATE', 'FULL_DAY', 'TRACKER', 'RAMADAN_EXCUSE');

-- CreateEnum
CREATE TYPE "QadaGoalMode" AS ENUM ('NONE', 'DEADLINE', 'PACE');

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "qadaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RafiqQadaEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "QadaKind" NOT NULL,
    "action" "QadaAction" NOT NULL,
    "count" INTEGER NOT NULL,
    "day" DATE,
    "batchId" TEXT,
    "source" "QadaSource" NOT NULL DEFAULT 'MANUAL',
    "sourceRef" TEXT,
    "byAdult" BOOLEAN NOT NULL DEFAULT false,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqQadaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqQadaPlan" (
    "userId" TEXT NOT NULL,
    "excuseDaysPerMonth" INTEGER,
    "estimate" JSONB,
    "prayerMode" "QadaGoalMode" NOT NULL DEFAULT 'NONE',
    "prayerDeadline" DATE,
    "prayerPace" INTEGER,
    "prayerFrom" DATE,
    "prayerBaseline" DOUBLE PRECISION,
    "fastMode" "QadaGoalMode" NOT NULL DEFAULT 'NONE',
    "fastDeadline" DATE,
    "fastPace" INTEGER,
    "fastFrom" DATE,
    "fastBaseline" DOUBLE PRECISION,
    "prayerMilestone" INTEGER NOT NULL DEFAULT 0,
    "prayerMilestoneAt" INTEGER NOT NULL DEFAULT 0,
    "fastMilestone" INTEGER NOT NULL DEFAULT 0,
    "fastMilestoneAt" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafiqQadaPlan_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "RafiqQadaEntry_userId_kind_idx" ON "RafiqQadaEntry"("userId", "kind");

-- CreateIndex
CREATE INDEX "RafiqQadaEntry_batchId_idx" ON "RafiqQadaEntry"("batchId");

-- CreateIndex
CREATE INDEX "RafiqQadaEntry_byId_idx" ON "RafiqQadaEntry"("byId");

-- AddForeignKey
ALTER TABLE "RafiqQadaEntry" ADD CONSTRAINT "RafiqQadaEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqQadaEntry" ADD CONSTRAINT "RafiqQadaEntry_byId_fkey" FOREIGN KEY ("byId") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqQadaPlan" ADD CONSTRAINT "RafiqQadaPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A count is 1–100,000; a made-up entry always has its day
ALTER TABLE "RafiqQadaEntry" ADD CONSTRAINT "RafiqQadaEntry_shape_check" CHECK (
  "count" BETWEEN 1 AND 100000
  AND ("action" = 'OWED' OR "day" IS NOT NULL)
);

-- Phase 2: an entry from a linked item or the Ramadan offer is added once at most
CREATE UNIQUE INDEX "RafiqQadaEntry_one_per_source" ON "RafiqQadaEntry"("userId", "source", "sourceRef") WHERE "sourceRef" IS NOT NULL;

-- The average is 0–15 days; a pace is positive (a day: 1–50 of each prayer; a week: 1–7 days)
ALTER TABLE "RafiqQadaPlan" ADD CONSTRAINT "RafiqQadaPlan_values_check" CHECK (
  ("excuseDaysPerMonth" IS NULL OR "excuseDaysPerMonth" BETWEEN 0 AND 15)
  AND ("prayerPace" IS NULL OR "prayerPace" BETWEEN 1 AND 50)
  AND ("fastPace" IS NULL OR "fastPace" BETWEEN 1 AND 7)
);
