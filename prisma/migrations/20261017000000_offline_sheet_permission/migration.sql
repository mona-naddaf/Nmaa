-- Who may use «التسميع بدون إنترنت» (download a day's sheet and upload it).
-- Additive only: one column with a default, so every existing course gets
-- ADMIN_ONLY (teachers off) and no row is otherwise touched.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "offlineSheetPermission" "AddStudentsPermission" NOT NULL DEFAULT 'ADMIN_ONLY';
