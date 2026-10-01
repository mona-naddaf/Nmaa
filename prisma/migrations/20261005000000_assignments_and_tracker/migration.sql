-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('QURAN', 'QUESTION', 'RESEARCH', 'OTHER');

-- CreateEnum
CREATE TYPE "TrackerItemStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "assignmentsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trackerEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HomeSegment" ADD COLUMN     "assignmentId" TEXT;

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssignmentType" NOT NULL,
    "dueDate" DATE,
    "surahNumber" INTEGER,
    "fromAyah" INTEGER,
    "toAyah" INTEGER,
    "targetGroupId" TEXT,
    "createdByTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentStudent" (
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "AssignmentStudent_pkey" PRIMARY KEY ("assignmentId","studentId")
);

-- CreateTable
CREATE TABLE "AssignmentCompletion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answer" TEXT,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER,
    "days" INTEGER NOT NULL DEFAULT 127,
    "targetGroupId" TEXT,
    "status" "TrackerItemStatus" NOT NULL DEFAULT 'APPROVED',
    "createdByTeacherId" TEXT,
    "createdByStudentId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerItemStudent" (
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "TrackerItemStudent_pkey" PRIMARY KEY ("itemId","studentId")
);

-- CreateTable
CREATE TABLE "TrackerCheck" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_courseId_createdAt_idx" ON "Assignment"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_targetGroupId_idx" ON "Assignment"("targetGroupId");

-- CreateIndex
CREATE INDEX "AssignmentStudent_studentId_idx" ON "AssignmentStudent"("studentId");

-- CreateIndex
CREATE INDEX "AssignmentCompletion_studentId_idx" ON "AssignmentCompletion"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentCompletion_assignmentId_studentId_key" ON "AssignmentCompletion"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "TrackerItem_courseId_status_idx" ON "TrackerItem"("courseId", "status");

-- CreateIndex
CREATE INDEX "TrackerItem_targetGroupId_idx" ON "TrackerItem"("targetGroupId");

-- CreateIndex
CREATE INDEX "TrackerItem_createdByStudentId_idx" ON "TrackerItem"("createdByStudentId");

-- CreateIndex
CREATE INDEX "TrackerItemStudent_studentId_idx" ON "TrackerItemStudent"("studentId");

-- CreateIndex
CREATE INDEX "TrackerCheck_studentId_day_idx" ON "TrackerCheck"("studentId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerCheck_itemId_studentId_day_key" ON "TrackerCheck"("itemId", "studentId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "HomeSegment_assignmentId_studentId_key" ON "HomeSegment"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "HomeSegment" ADD CONSTRAINT "HomeSegment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStudent" ADD CONSTRAINT "AssignmentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentCompletion" ADD CONSTRAINT "AssignmentCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentCompletion" ADD CONSTRAINT "AssignmentCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_createdByStudentId_fkey" FOREIGN KEY ("createdByStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerItemStudent" ADD CONSTRAINT "TrackerItemStudent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerItemStudent" ADD CONSTRAINT "TrackerItemStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerCheck" ADD CONSTRAINT "TrackerCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerCheck" ADD CONSTRAINT "TrackerCheck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: database-level backstops for rules the server actions
-- already enforce (score 1–10 once set; at least one weekday chosen).
ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_value_range" CHECK ("value" IS NULL OR ("value" BETWEEN 1 AND 10));
ALTER TABLE "TrackerItem" ADD CONSTRAINT "TrackerItem_days_range" CHECK ("days" BETWEEN 1 AND 127);
