-- Student login (phase 1). Purely additive: a new lockout scope, three
-- course settings that all default to off / supervisor-only, and a student
-- code that starts empty for every student. No existing row changes meaning.

-- AlterEnum
ALTER TYPE "LoginScope" ADD VALUE 'STUDENT';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "issueStudentCodesPermission" "AddStudentsPermission" NOT NULL DEFAULT 'ADMIN_ONLY',
ADD COLUMN     "studentBoardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "studentLoginEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "studentCode" TEXT,
ADD COLUMN     "studentCodeCreatedAt" TIMESTAMP(3),
ADD COLUMN     "studentCodeVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");

