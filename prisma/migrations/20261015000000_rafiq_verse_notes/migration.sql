-- «رفيق الحفظ» verse notes and tags.
-- Additive only: one nullable column on RafiqUser and three new tables, all
-- keyed by the learner and deleted with her account. Writes no rows: default
-- tags are created later, once, the first time she opens her notes.

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "noteTagsSeededAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RafiqNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafiqNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqNoteTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RafiqNoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqNoteTagLink" (
    "noteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "RafiqNoteTagLink_pkey" PRIMARY KEY ("noteId","tagId")
);

-- CreateIndex
CREATE INDEX "RafiqNote_userId_surahNumber_ayah_idx" ON "RafiqNote"("userId", "surahNumber", "ayah");

-- CreateIndex
CREATE INDEX "RafiqNote_userId_createdAt_idx" ON "RafiqNote"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqNoteTag_userId_name_key" ON "RafiqNoteTag"("userId", "name");

-- CreateIndex
CREATE INDEX "RafiqNoteTagLink_tagId_idx" ON "RafiqNoteTagLink"("tagId");

-- AddForeignKey
ALTER TABLE "RafiqNote" ADD CONSTRAINT "RafiqNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqNoteTag" ADD CONSTRAINT "RafiqNoteTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqNoteTagLink" ADD CONSTRAINT "RafiqNoteTagLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "RafiqNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqNoteTagLink" ADD CONSTRAINT "RafiqNoteTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "RafiqNoteTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

