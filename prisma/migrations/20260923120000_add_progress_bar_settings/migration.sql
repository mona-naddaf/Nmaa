-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "showJuzProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showPlanProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showQuranProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showSurahProgress" BOOLEAN NOT NULL DEFAULT false;
