-- CreateEnum
CREATE TYPE "AddStudentsPermission" AS ENUM ('ADMIN_ONLY', 'ALL_TEACHERS');

-- CreateEnum
CREATE TYPE "VisibilityMode" AS ENUM ('ALL_TEACHERS', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "PlanTemplate" AS ENUM ('MUSHAF_ORDER', 'JUZ_AMMA_REVERSE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('IN', 'OUT', 'PENDING');

-- CreateEnum
CREATE TYPE "PointType" AS ENUM ('ADD', 'SUBTRACT');

-- CreateEnum
CREATE TYPE "RecitationQuality" AS ENUM ('EXCELLENT', 'GOOD', 'NEEDS_REPEAT');

-- CreateEnum
CREATE TYPE "RecitationMode" AS ENUM ('IN_PERSON', 'ONLINE');

-- CreateEnum
CREATE TYPE "RecitationSituation" AS ENUM ('CONTINUE', 'NEXT', 'SURAH_GAP', 'AYAH_GAP', 'EDIT');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "addStudentsPermission" "AddStudentsPermission" NOT NULL DEFAULT 'ADMIN_ONLY',
    "visibilityMode" "VisibilityMode" NOT NULL DEFAULT 'ALL_TEACHERS',
    "onlineRecitationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherGroupAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "TeacherGroupAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsActivity" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "type" "PointType" NOT NULL DEFAULT 'ADD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "planTemplate" "PlanTemplate" NOT NULL DEFAULT 'CUSTOM',
    "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "attendanceDay" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecitationSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "fromAyah" INTEGER NOT NULL,
    "toAyah" INTEGER NOT NULL,
    "pagesCalculated" DECIMAL(7,3) NOT NULL,
    "quality" "RecitationQuality" NOT NULL,
    "mode" "RecitationMode" NOT NULL,
    "situation" "RecitationSituation" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecitationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "valueAtTime" INTEGER NOT NULL,
    "typeAtTime" "PointType" NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Course_adminId_key" ON "Course"("adminId");

-- CreateIndex
CREATE INDEX "Teacher_courseId_idx" ON "Teacher"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_courseId_nameKey_key" ON "Teacher"("courseId", "nameKey");

-- CreateIndex
CREATE INDEX "Group_courseId_idx" ON "Group"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_courseId_name_key" ON "Group"("courseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherGroupAssignment_teacherId_groupId_key" ON "TeacherGroupAssignment"("teacherId", "groupId");

-- CreateIndex
CREATE INDEX "PointsActivity_courseId_idx" ON "PointsActivity"("courseId");

-- CreateIndex
CREATE INDEX "Student_courseId_idx" ON "Student"("courseId");

-- CreateIndex
CREATE INDEX "Student_groupId_idx" ON "Student"("groupId");

-- CreateIndex
CREATE INDEX "PlanItem_studentId_idx" ON "PlanItem"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_studentId_position_key" ON "PlanItem"("studentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_studentId_surahNumber_key" ON "PlanItem"("studentId", "surahNumber");

-- CreateIndex
CREATE INDEX "RecitationSession_studentId_occurredAt_idx" ON "RecitationSession"("studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "PointsLog_studentId_day_idx" ON "PointsLog"("studentId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "PointsLog_studentId_activityId_day_key" ON "PointsLog"("studentId", "activityId", "day");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherGroupAssignment" ADD CONSTRAINT "TeacherGroupAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherGroupAssignment" ADD CONSTRAINT "TeacherGroupAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsActivity" ADD CONSTRAINT "PointsActivity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationSession" ADD CONSTRAINT "RecitationSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecitationSession" ADD CONSTRAINT "RecitationSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLog" ADD CONSTRAINT "PointsLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLog" ADD CONSTRAINT "PointsLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "PointsActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLog" ADD CONSTRAINT "PointsLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
