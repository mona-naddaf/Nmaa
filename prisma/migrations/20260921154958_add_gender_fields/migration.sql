-- CreateEnum
CREATE TYPE "GroupGender" AS ENUM ('GIRLS', 'BOYS', 'MIXED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "genderPrompted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "gender" "GroupGender" NOT NULL DEFAULT 'GIRLS';

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "genderPrompted" BOOLEAN NOT NULL DEFAULT false;
