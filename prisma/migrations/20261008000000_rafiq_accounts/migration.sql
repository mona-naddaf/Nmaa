-- «رفيق الحفظ» phase 1: independent-learner accounts. Additive only: one new
-- table and new LoginScope values; no existing table or column changes.

-- Attempt limits for Rafiq sign-up, login and password recovery
-- (src/lib/rafiq/limits.ts).
ALTER TYPE "LoginScope" ADD VALUE 'RAFIQ_LOGIN';
ALTER TYPE "LoginScope" ADD VALUE 'RAFIQ_ACCOUNT';
ALTER TYPE "LoginScope" ADD VALUE 'RAFIQ_SIGNUP';
ALTER TYPE "LoginScope" ADD VALUE 'RAFIQ_RECOVER';

-- CreateTable
CREATE TABLE "RafiqUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "gender" "Gender" NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "recoveryCodeHash" TEXT NOT NULL,
    "recoveryCodeCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "RafiqUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RafiqUser_email_key" ON "RafiqUser"("email");
