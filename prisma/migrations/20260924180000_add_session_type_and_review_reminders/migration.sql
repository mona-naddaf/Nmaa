-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('NEW', 'REVIEW', 'LINK');

-- AlterTable: every existing session becomes NEW, so past data is not
-- reinterpreted and every student's position / coverage stays the same
ALTER TABLE "RecitationSession" ADD COLUMN     "type" "SessionType" NOT NULL DEFAULT 'NEW';

-- AlterTable: null = reminders off (the default for existing courses)
ALTER TABLE "Course" ADD COLUMN     "reviewReminderDays" INTEGER;
