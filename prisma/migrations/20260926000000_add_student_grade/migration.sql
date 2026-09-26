-- AlterTable: optional, so existing students simply have no grade
ALTER TABLE "Student" ADD COLUMN     "grade" TEXT;
