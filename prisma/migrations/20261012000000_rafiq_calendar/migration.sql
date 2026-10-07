-- «رفيق الحفظ» phase 5: her calendar. Additive only: one column with a
-- default on RafiqUser and two new Rafiq tables; no course table or column
-- changes.

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "enabledOccasions" "Occasion"[] DEFAULT ARRAY[]::"Occasion"[];

-- CreateTable
CREATE TABLE "RafiqCalendarDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafiqCalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqCalendarAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occasion" "Occasion" NOT NULL,
    "hijriYear" INTEGER NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqCalendarAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RafiqCalendarDay_userId_date_idx" ON "RafiqCalendarDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqCalendarAdjustment_userId_occasion_hijriYear_key" ON "RafiqCalendarAdjustment"("userId", "occasion", "hijriYear");

-- AddForeignKey
ALTER TABLE "RafiqCalendarDay" ADD CONSTRAINT "RafiqCalendarDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqCalendarAdjustment" ADD CONSTRAINT "RafiqCalendarAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

