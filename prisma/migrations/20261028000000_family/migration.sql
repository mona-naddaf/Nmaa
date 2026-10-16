-- CreateEnum
CREATE TYPE "RafiqUserKind" AS ENUM ('ADULT', 'CHILD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LoginScope" ADD VALUE 'FAMILY_CHILD_LOGIN';
ALTER TYPE "LoginScope" ADD VALUE 'FAMILY_JOIN';

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "childCode" TEXT,
ADD COLUMN     "childCodeCreatedAt" TIMESTAMP(3),
ADD COLUMN     "childCodeVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "goalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homeLogEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homeMistakesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "RafiqUserKind" NOT NULL DEFAULT 'ADULT',
ADD COLUMN     "streakEnabled" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL,
ALTER COLUMN "recoveryCodeHash" DROP NOT NULL,
ALTER COLUMN "recoveryCodeCreatedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RafiqTrackerItem" ADD COLUMN     "adultAdded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "RafiqSession" ADD COLUMN     "recordedByAdult" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recordedById" TEXT;

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,
    "siblingsVisible" BOOLEAN NOT NULL DEFAULT false,
    "enabledOccasions" "Occasion"[] DEFAULT ARRAY[]::"Occasion"[],
    "prayerCityKey" TEXT,
    "prayerPlace" TEXT,
    "prayerLat" DOUBLE PRECISION,
    "prayerLng" DOUBLE PRECISION,
    "prayerMethod" TEXT,
    "prayerAsr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEditChildren" BOOLEAN NOT NULL DEFAULT false,
    "shareTracker" BOOLEAN NOT NULL DEFAULT false,
    "shareProgress" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyInvite" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyEvent" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyCalendarAdjustment" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "occasion" "Occasion" NOT NULL,
    "hijriYear" INTEGER NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyCalendarAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Family_founderId_idx" ON "Family"("founderId");

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "FamilyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_code_key" ON "FamilyInvite"("code");

-- CreateIndex
CREATE INDEX "FamilyInvite_familyId_idx" ON "FamilyInvite"("familyId");

-- CreateIndex
CREATE INDEX "FamilyEvent_familyId_date_idx" ON "FamilyEvent"("familyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCalendarAdjustment_familyId_occasion_hijriYear_key" ON "FamilyCalendarAdjustment"("familyId", "occasion", "hijriYear");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqUser_childCode_key" ON "RafiqUser"("childCode");

-- CreateIndex
CREATE INDEX "RafiqUser_familyId_idx" ON "RafiqUser"("familyId");

-- AddForeignKey
ALTER TABLE "RafiqUser" ADD CONSTRAINT "RafiqUser_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqUser" ADD CONSTRAINT "RafiqUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqTrackerItem" ADD CONSTRAINT "RafiqTrackerItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqSession" ADD CONSTRAINT "RafiqSession_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_founderId_fkey" FOREIGN KEY ("founderId") REFERENCES "RafiqUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEvent" ADD CONSTRAINT "FamilyEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEvent" ADD CONSTRAINT "FamilyEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCalendarAdjustment" ADD CONSTRAINT "FamilyCalendarAdjustment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- «العائلة»: keep the two kinds of RafiqUser apart (not expressible in the
-- Prisma schema). An ADULT always has her email, password and recovery رمز,
-- and none of the child fields; a CHILD has a name and a family, and no email,
-- password or recovery رمز. Every existing row is an ADULT with all four set.
ALTER TABLE "RafiqUser" ADD CONSTRAINT "RafiqUser_kind_shape_check" CHECK (
  ("kind" = 'ADULT' AND "email" IS NOT NULL AND "passwordHash" IS NOT NULL
     AND "recoveryCodeHash" IS NOT NULL AND "recoveryCodeCreatedAt" IS NOT NULL
     AND "familyId" IS NULL AND "childCode" IS NULL)
  OR
  ("kind" = 'CHILD' AND "name" IS NOT NULL AND "familyId" IS NOT NULL
     AND "email" IS NULL AND "passwordHash" IS NULL
     AND "recoveryCodeHash" IS NULL AND "recoveryCodeCreatedAt" IS NULL)
);
