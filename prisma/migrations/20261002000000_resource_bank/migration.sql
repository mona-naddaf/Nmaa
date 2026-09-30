-- Resource bank: the first data shared across ALL courses. Purely additive:
-- new tables only, no existing table changes except new relations pointing
-- at Admin/Teacher. No row has a courseId.

-- CreateTable
CREATE TABLE "ResourceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ageFrom" INTEGER NOT NULL,
    "ageTo" INTEGER NOT NULL,
    "typeId" TEXT NOT NULL,
    "searchKey" TEXT NOT NULL,
    "createdByAdminId" TEXT,
    "createdByTeacherId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceTag" (
    "resourceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ResourceTag_pkey" PRIMARY KEY ("resourceId","tagId")
);

-- CreateTable
CREATE TABLE "ResourceReport" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reason" TEXT,
    "reporterAdminId" TEXT,
    "reporterTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ResourceReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceType_name_key" ON "ResourceType"("name");

-- CreateIndex
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");

-- CreateIndex
CREATE INDEX "Resource_typeId_idx" ON "Resource"("typeId");

-- CreateIndex
CREATE INDEX "Resource_createdByAdminId_idx" ON "Resource"("createdByAdminId");

-- CreateIndex
CREATE INDEX "Resource_createdByTeacherId_idx" ON "Resource"("createdByTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_key_key" ON "Tag"("key");

-- CreateIndex
CREATE INDEX "ResourceTag_tagId_idx" ON "ResourceTag"("tagId");

-- CreateIndex
CREATE INDEX "ResourceReport_resourceId_resolvedAt_idx" ON "ResourceReport"("resourceId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ResourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceTag" ADD CONSTRAINT "ResourceTag_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceTag" ADD CONSTRAINT "ResourceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceReport" ADD CONSTRAINT "ResourceReport_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceReport" ADD CONSTRAINT "ResourceReport_reporterAdminId_fkey" FOREIGN KEY ("reporterAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceReport" ADD CONSTRAINT "ResourceReport_reporterTeacherId_fkey" FOREIGN KEY ("reporterTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------- rules Prisma can't express ----------

-- a resource never has two creators (none is fine: the creator's account is gone)
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_single_creator"
  CHECK (NOT ("createdByAdminId" IS NOT NULL AND "createdByTeacherId" IS NOT NULL));
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_age_range"
  CHECK ("ageFrom" BETWEEN 1 AND 25 AND "ageTo" BETWEEN 1 AND 25 AND "ageTo" >= "ageFrom");
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_url_http"
  CHECK ("url" ~* '^https?://' AND length("url") <= 2000);
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_title_not_blank"
  CHECK (length(btrim("title")) > 0);

ALTER TABLE "ResourceReport" ADD CONSTRAINT "ResourceReport_single_reporter"
  CHECK (NOT ("reporterAdminId" IS NOT NULL AND "reporterTeacherId" IS NOT NULL));
-- one OPEN report per person per resource
CREATE UNIQUE INDEX "ResourceReport_open_by_admin" ON "ResourceReport"("resourceId", "reporterAdminId")
  WHERE "resolvedAt" IS NULL AND "reporterAdminId" IS NOT NULL;
CREATE UNIQUE INDEX "ResourceReport_open_by_teacher" ON "ResourceReport"("resourceId", "reporterTeacherId")
  WHERE "resolvedAt" IS NULL AND "reporterTeacherId" IS NOT NULL;

-- ---------- seed: the seven starting types ----------
INSERT INTO "ResourceType" ("id", "name", "sortOrder") VALUES
  ('rtype_activities',    'أنشطة',  0),
  ('rtype_materials',     'موارد',  1),
  ('rtype_references',    'مراجع',  2),
  ('rtype_presentations', 'عروض',   3),
  ('rtype_art',           'فني',    4),
  ('rtype_play',          'مسرحية', 5),
  ('rtype_nasheeds',      'أناشيد', 6);
