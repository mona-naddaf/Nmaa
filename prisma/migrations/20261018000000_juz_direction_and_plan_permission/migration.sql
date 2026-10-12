-- «ترتيب المصحف بالعكس» with a direction per juz, and editing a student's plan.
-- Additive only: two new enums, one new table (empty until the backfill
-- script or a recitation fills it), and three columns with defaults or NULL.
-- No existing row changes meaning:
--   * no StudentJuzDirection row = «من آخره», i.e. the original reverse order;
--   * Course.editPlanPermission defaults to ADMIN_ONLY (teachers off);
--   * Student.planChangedAt is NULL (plan never changed by hand);
--   * RecitationSession.createdAt is filled with the migration's time for
--     existing rows, which precedes any later plan change.

-- CreateEnum
CREATE TYPE "JuzDirection" AS ENUM ('FROM_START', 'FROM_END');

-- CreateEnum
CREATE TYPE "JuzDirectionSource" AS ENUM ('AUTO', 'BACKFILL', 'MANUAL');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "editPlanPermission" "AddStudentsPermission" NOT NULL DEFAULT 'ADMIN_ONLY';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "planChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RecitationSession" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "StudentJuzDirection" (
    "studentId" TEXT NOT NULL,
    "juz" INTEGER NOT NULL,
    "direction" "JuzDirection" NOT NULL,
    "source" "JuzDirectionSource" NOT NULL,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentJuzDirection_pkey" PRIMARY KEY ("studentId","juz")
);

-- AddForeignKey
ALTER TABLE "StudentJuzDirection" ADD CONSTRAINT "StudentJuzDirection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
