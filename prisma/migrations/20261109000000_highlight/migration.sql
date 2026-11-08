-- «التظليل» (src/lib/highlight). Additive only: two new tables (empty) and
-- a per-child switch that is off for everyone, so nothing changes until a
-- highlight is made. Undo with prisma/rollback/20261109_highlight_down.sql.

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "highlightEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RafiqHighlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "fromAyah" INTEGER NOT NULL,
    "fromWord" INTEGER NOT NULL,
    "toAyah" INTEGER NOT NULL,
    "toWord" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "byAdult" BOOLEAN NOT NULL DEFAULT false,
    "byId" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafiqHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqHighlightColor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqHighlightColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RafiqHighlight_userId_surahNumber_idx" ON "RafiqHighlight"("userId", "surahNumber");

-- CreateIndex
CREATE INDEX "RafiqHighlight_byId_idx" ON "RafiqHighlight"("byId");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqHighlightColor_userId_color_key" ON "RafiqHighlightColor"("userId", "color");

-- AddForeignKey
ALTER TABLE "RafiqHighlight" ADD CONSTRAINT "RafiqHighlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqHighlight" ADD CONSTRAINT "RafiqHighlight_byId_fkey" FOREIGN KEY ("byId") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqHighlightColor" ADD CONSTRAINT "RafiqHighlightColor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

