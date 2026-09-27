-- CreateEnum
CREATE TYPE "StreakMode" AS ENUM ('ATTENDANCE', 'RECITATION');

-- AlterTable: null = streaks off, so existing courses show nothing until the
-- supervisor picks a mode
ALTER TABLE "Course" ADD COLUMN     "streakMode" "StreakMode";

