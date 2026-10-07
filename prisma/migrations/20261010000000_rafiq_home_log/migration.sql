-- «رفيق الحفظ» phase 3: home memorization counters. Additive only: three
-- columns with defaults on RafiqUser and two new Rafiq tables; no course
-- table or column changes.

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "homeTargetListen" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "homeTargetRecite" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "homeTargetRepeat" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "RafiqHomeSegment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "fromAyah" INTEGER NOT NULL,
    "toAyah" INTEGER NOT NULL,
    "targetListen" INTEGER NOT NULL,
    "targetRepeat" INTEGER NOT NULL,
    "targetRecite" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "finishedBySession" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RafiqHomeSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqHomeTap" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ayah" INTEGER,
    "kind" "HomeTapKind" NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqHomeTap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RafiqHomeSegment_userId_finishedAt_idx" ON "RafiqHomeSegment"("userId", "finishedAt");

-- CreateIndex
CREATE INDEX "RafiqHomeTap_segmentId_kind_ayah_idx" ON "RafiqHomeTap"("segmentId", "kind", "ayah");

-- CreateIndex
CREATE INDEX "RafiqHomeTap_userId_createdAt_idx" ON "RafiqHomeTap"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RafiqHomeSegment" ADD CONSTRAINT "RafiqHomeSegment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqHomeTap" ADD CONSTRAINT "RafiqHomeTap_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "RafiqHomeSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqHomeTap" ADD CONSTRAINT "RafiqHomeTap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

