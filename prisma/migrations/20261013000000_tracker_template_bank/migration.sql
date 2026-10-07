-- «رفيق الحفظ» phase 6: the tracker template bank. Additive only: three new
-- tables; no course table or column changes.

-- CreateTable
CREATE TABLE "TrackerTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "searchKey" TEXT NOT NULL,
    "suggested" BOOLEAN NOT NULL DEFAULT false,
    "createdByRafiqId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrackerTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerTemplateReport" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "reason" TEXT,
    "reporterRafiqId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TrackerTemplateReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackerTemplate_createdAt_idx" ON "TrackerTemplate"("createdAt");

-- CreateIndex
CREATE INDEX "TrackerTemplate_createdByRafiqId_idx" ON "TrackerTemplate"("createdByRafiqId");

-- CreateIndex
CREATE INDEX "TrackerTemplateItem_templateId_idx" ON "TrackerTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "TrackerTemplateReport_templateId_resolvedAt_idx" ON "TrackerTemplateReport"("templateId", "resolvedAt");

-- CreateIndex
CREATE INDEX "TrackerTemplateReport_reporterRafiqId_createdAt_idx" ON "TrackerTemplateReport"("reporterRafiqId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrackerTemplate" ADD CONSTRAINT "TrackerTemplate_createdByRafiqId_fkey" FOREIGN KEY ("createdByRafiqId") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerTemplateItem" ADD CONSTRAINT "TrackerTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrackerTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerTemplateReport" ADD CONSTRAINT "TrackerTemplateReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrackerTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerTemplateReport" ADD CONSTRAINT "TrackerTemplateReport_reporterRafiqId_fkey" FOREIGN KEY ("reporterRafiqId") REFERENCES "RafiqUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One open report per person per template (as ResourceReport).
CREATE UNIQUE INDEX "TrackerTemplateReport_open_by_rafiq" ON "TrackerTemplateReport"("templateId", "reporterRafiqId")
  WHERE "resolvedAt" IS NULL AND "reporterRafiqId" IS NOT NULL;
