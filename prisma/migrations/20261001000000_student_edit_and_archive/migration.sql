-- Edit and archive students. Purely additive: two course permissions that
-- default to supervisor-only, and an archive marker on students. Every
-- existing student stays active (archivedAt null); no history changes.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "archiveStudentsPermission" "AddStudentsPermission" NOT NULL DEFAULT 'ADMIN_ONLY',
ADD COLUMN     "editStudentsPermission" "AddStudentsPermission" NOT NULL DEFAULT 'ADMIN_ONLY';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "keepInReports" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Student_courseId_archivedAt_idx" ON "Student"("courseId", "archivedAt");
