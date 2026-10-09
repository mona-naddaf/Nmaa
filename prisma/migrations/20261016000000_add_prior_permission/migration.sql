-- Who may add prior memorization (حفظ سابق) to an existing student.
-- Additive only: one column with a default, so every existing course gets
-- ADMIN_ONLY (teachers off) and no row is otherwise touched.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "addPriorPermission" "AddStudentsPermission" NOT NULL DEFAULT 'ADMIN_ONLY';
