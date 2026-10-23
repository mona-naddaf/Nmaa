-- In-site guidance (src/lib/guide). Additive only: existing accounts keep
-- guideNewAt = NULL, which means "already onboarded" — no backfill.

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "guideNewAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GuideState" (
    "id" TEXT NOT NULL,
    "rafiqUserId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuideState_rafiqUserId_key_key" ON "GuideState"("rafiqUserId", "key");

-- AddForeignKey
ALTER TABLE "GuideState" ADD CONSTRAINT "GuideState_rafiqUserId_fkey" FOREIGN KEY ("rafiqUserId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
