-- One «حفظ جديد» entry that also covered already-memorized ayat is saved as
-- several rows (NEW for the new ayat, LINK for the memorized ones) sharing
-- a comboId. Additive only: one nullable column and its index. Every
-- existing row keeps comboId NULL and means exactly what it meant before.

-- AlterTable
ALTER TABLE "RecitationSession" ADD COLUMN     "comboId" TEXT;

-- CreateIndex
CREATE INDEX "RecitationSession_comboId_idx" ON "RecitationSession"("comboId");
