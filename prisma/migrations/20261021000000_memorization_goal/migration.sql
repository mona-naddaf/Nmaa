-- An optional memorization goal with a deadline (src/lib/goals/goal.ts),
-- for course students (StudentGoal) and «رفيق الحفظ» users (RafiqGoal).
-- Additive only: one enum and two new tables. No existing table, column
-- or row is changed; a student or user without a goal has no row.

-- CreateEnum
CREATE TYPE "GoalTarget" AS ENUM ('PLAN', 'JUZ', 'POINT');

-- CreateTable
CREATE TABLE "StudentGoal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "target" "GoalTarget" NOT NULL,
    "juz" INTEGER,
    "surah" INTEGER,
    "ayah" INTEGER,
    "startDay" DATE NOT NULL,
    "deadline" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RafiqGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" "GoalTarget" NOT NULL,
    "juz" INTEGER,
    "surah" INTEGER,
    "ayah" INTEGER,
    "startDay" DATE NOT NULL,
    "deadline" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafiqGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentGoal_studentId_key" ON "StudentGoal"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqGoal_userId_key" ON "RafiqGoal"("userId");

-- AddForeignKey
ALTER TABLE "StudentGoal" ADD CONSTRAINT "StudentGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafiqGoal" ADD CONSTRAINT "RafiqGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RafiqUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

