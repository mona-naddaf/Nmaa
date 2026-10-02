-- Extra student information («معلومات إضافية»). Purely additive: two course
-- switches that default to off, a per-course field config table and a
-- per-student values table. No existing row changes; built-in field rows are
-- created on demand by the app (all disabled).

-- CreateEnum
CREATE TYPE "StudentInfoBuiltin" AS ENUM ('MOTHER_NAME', 'MOTHER_PHONE', 'MOTHER_JOB', 'FATHER_NAME', 'FATHER_PHONE', 'FATHER_JOB', 'STUDENT_PHONE', 'STUDY_OR_WORK');

-- CreateEnum
CREATE TYPE "InfoEditor" AS ENUM ('ADMIN', 'TEACHER', 'PARENT');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "parentStudentInfoEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "studentInfoEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudentInfoField" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "builtinKey" "StudentInfoBuiltin",
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "visibleToTeachers" BOOLEAN NOT NULL DEFAULT true,
    "visibleToParents" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentInfoField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentInfoValue" (
    "studentId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" "InfoEditor" NOT NULL,

    CONSTRAINT "StudentInfoValue_pkey" PRIMARY KEY ("studentId","fieldId")
);

-- CreateIndex
CREATE INDEX "StudentInfoField_courseId_sortOrder_idx" ON "StudentInfoField"("courseId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StudentInfoField_courseId_builtinKey_key" ON "StudentInfoField"("courseId", "builtinKey");

-- CreateIndex
CREATE INDEX "StudentInfoValue_fieldId_idx" ON "StudentInfoValue"("fieldId");

-- AddForeignKey
ALTER TABLE "StudentInfoField" ADD CONSTRAINT "StudentInfoField_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInfoValue" ADD CONSTRAINT "StudentInfoValue_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInfoValue" ADD CONSTRAINT "StudentInfoValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "StudentInfoField"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A field is either built-in (label comes from code) or custom (has a name).
ALTER TABLE "StudentInfoField" ADD CONSTRAINT "StudentInfoField_builtin_or_label_check"
  CHECK (("builtinKey" IS NULL) <> ("label" IS NULL));

-- Clearing a value deletes its row, so a stored value is never blank.
ALTER TABLE "StudentInfoValue" ADD CONSTRAINT "StudentInfoValue_value_not_blank_check"
  CHECK (btrim("value") <> '');
