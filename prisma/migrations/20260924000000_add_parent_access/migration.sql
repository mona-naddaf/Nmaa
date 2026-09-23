-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "parentCode" TEXT,
ADD COLUMN     "parentCodeCreatedAt" TIMESTAMP(3),
ADD COLUMN     "parentCodeVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ParentLoginAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_parentCode_key" ON "Student"("parentCode");

-- CreateIndex
CREATE INDEX "ParentLoginAttempt_ipHash_createdAt_idx" ON "ParentLoginAttempt"("ipHash", "createdAt");
