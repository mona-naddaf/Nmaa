-- CreateEnum
CREATE TYPE "LoginScope" AS ENUM ('PARENT', 'BOARD');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "boardCode" TEXT,
ADD COLUMN     "boardCodeCreatedAt" TIMESTAMP(3),
ADD COLUMN     "boardCodeVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Course_boardCode_key" ON "Course"("boardCode");

-- Generalize ParentLoginAttempt -> LoginAttempt in place (rather than the
-- drop/create Prisma would generate), so any live lockout rows survive.
-- Every existing row came from the parent login.
ALTER TABLE "ParentLoginAttempt" RENAME TO "LoginAttempt";
ALTER TABLE "LoginAttempt" RENAME CONSTRAINT "ParentLoginAttempt_pkey" TO "LoginAttempt_pkey";
ALTER TABLE "LoginAttempt" ADD COLUMN "scope" "LoginScope" NOT NULL DEFAULT 'PARENT';
ALTER TABLE "LoginAttempt" ALTER COLUMN "scope" DROP DEFAULT;
DROP INDEX "ParentLoginAttempt_ipHash_createdAt_idx";
CREATE INDEX "LoginAttempt_scope_ipHash_createdAt_idx" ON "LoginAttempt"("scope", "ipHash", "createdAt");
