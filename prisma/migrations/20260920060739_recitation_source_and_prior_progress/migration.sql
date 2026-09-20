-- CreateEnum
CREATE TYPE "RecitationSource" AS ENUM ('LOGGED', 'PRIOR');

-- AlterTable
ALTER TABLE "RecitationSession" ADD COLUMN     "source" "RecitationSource" NOT NULL DEFAULT 'LOGGED',
ALTER COLUMN "quality" DROP NOT NULL,
ALTER COLUMN "mode" DROP NOT NULL,
ALTER COLUMN "situation" DROP NOT NULL;
