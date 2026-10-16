-- «أخطاء التجويد المفصّلة» (src/lib/tajweed): a tajweed mistake on one letter
-- of a word or on the gap after it, with its kind (مخرج / صفة / حكم) and rule.
-- Additive: three switches, all false by default (the course, each student,
-- each «رفيق الحفظ» user), and six columns on each of the four mistake
-- tables whose defaults describe every existing row exactly (a plain
-- whole-word mistake). The only replaced objects are the uniqueness rules,
-- widened from "one per word" to "one per word + spot + kind + code"; every
-- existing row satisfies the new ones.

-- CreateEnum
CREATE TYPE "TajweedKind" AS ENUM ('NONE', 'MAKHRAJ', 'SIFA', 'HUKM');

-- DropIndex
DROP INDEX "RecitationMistake_sessionId_surahNumber_ayah_wordPosition_key";

-- DropIndex
DROP INDEX "RafiqMistake_sessionId_surahNumber_ayah_wordPosition_key";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "tajweedDetailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "tajweedDetailed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecitationMistake" ADD COLUMN     "confusedWith" TEXT,
ADD COLUMN     "gapAfter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "letter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "letterText" TEXT,
ADD COLUMN     "tajweedCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tajweedKind" "TajweedKind" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "HomeMistake" ADD COLUMN     "confusedWith" TEXT,
ADD COLUMN     "gapAfter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "letter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "letterText" TEXT,
ADD COLUMN     "tajweedCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tajweedKind" "TajweedKind" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "tajweedDetailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RafiqHomeMistake" ADD COLUMN     "confusedWith" TEXT,
ADD COLUMN     "gapAfter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "letter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "letterText" TEXT,
ADD COLUMN     "tajweedCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tajweedKind" "TajweedKind" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "RafiqMistake" ADD COLUMN     "confusedWith" TEXT,
ADD COLUMN     "gapAfter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "letter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "letterText" TEXT,
ADD COLUMN     "tajweedCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tajweedKind" "TajweedKind" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX "RecitationMistake_sessionId_surahNumber_ayah_wordPosition_l_key" ON "RecitationMistake"("sessionId", "surahNumber", "ayah", "wordPosition", "letter", "gapAfter", "tajweedKind", "tajweedCode");

-- CreateIndex
CREATE UNIQUE INDEX "RafiqMistake_sessionId_surahNumber_ayah_wordPosition_letter_key" ON "RafiqMistake"("sessionId", "surahNumber", "ayah", "wordPosition", "letter", "gapAfter", "tajweedKind", "tajweedCode");


-- ---------- written by hand (not expressible in schema.prisma) ----------

-- Home marks: at most one open mark per learner per word + spot + kind +
-- code (was: per word).
DROP INDEX "HomeMistake_open_word";
DROP INDEX "RafiqHomeMistake_open_word";
CREATE UNIQUE INDEX "HomeMistake_open_spot" ON "HomeMistake"("studentId", "surahNumber", "ayah", "wordPosition", "letter", "gapAfter", "tajweedKind", "tajweedCode")
  WHERE "resolvedAt" IS NULL;
CREATE UNIQUE INDEX "RafiqHomeMistake_open_spot" ON "RafiqHomeMistake"("userId", "surahNumber", "ayah", "wordPosition", "letter", "gapAfter", "tajweedKind", "tajweedCode")
  WHERE "resolvedAt" IS NULL;

-- The same rules on all four tables:
--  spot:    letter >= 0, and a gap is never on a letter
--  detail:  a whole-word mistake is plain (NONE); a letter or gap one is detailed
--  type:    a detailed mistake is a TAJWEED mistake
--  plain:   a plain mistake has no code, letter or «قريبًا من حرف»
--  gap:     a gap holds rules (HUKM) only
--  confused: «قريبًا من حرف» on makhraj mistakes only, one letter
--  letter:  letterText exactly when on a letter
ALTER TABLE "RecitationMistake"
  ADD CONSTRAINT "RecitationMistake_tajweed_spot" CHECK ("letter" >= 0 AND NOT ("letter" > 0 AND "gapAfter")),
  ADD CONSTRAINT "RecitationMistake_tajweed_detail" CHECK (("tajweedKind" = 'NONE') = ("letter" = 0 AND NOT "gapAfter")),
  ADD CONSTRAINT "RecitationMistake_tajweed_type" CHECK ("tajweedKind" = 'NONE' OR "type" = 'TAJWEED'),
  ADD CONSTRAINT "RecitationMistake_tajweed_plain" CHECK ("tajweedKind" <> 'NONE' OR ("tajweedCode" = '' AND "confusedWith" IS NULL)),
  ADD CONSTRAINT "RecitationMistake_tajweed_gap" CHECK (NOT "gapAfter" OR "tajweedKind" = 'HUKM'),
  ADD CONSTRAINT "RecitationMistake_tajweed_confused" CHECK ("confusedWith" IS NULL OR ("tajweedKind" = 'MAKHRAJ' AND char_length("confusedWith") = 1)),
  ADD CONSTRAINT "RecitationMistake_tajweed_letter" CHECK (("letterText" IS NOT NULL) = ("letter" > 0));

ALTER TABLE "RafiqMistake"
  ADD CONSTRAINT "RafiqMistake_tajweed_spot" CHECK ("letter" >= 0 AND NOT ("letter" > 0 AND "gapAfter")),
  ADD CONSTRAINT "RafiqMistake_tajweed_detail" CHECK (("tajweedKind" = 'NONE') = ("letter" = 0 AND NOT "gapAfter")),
  ADD CONSTRAINT "RafiqMistake_tajweed_type" CHECK ("tajweedKind" = 'NONE' OR "type" = 'TAJWEED'),
  ADD CONSTRAINT "RafiqMistake_tajweed_plain" CHECK ("tajweedKind" <> 'NONE' OR ("tajweedCode" = '' AND "confusedWith" IS NULL)),
  ADD CONSTRAINT "RafiqMistake_tajweed_gap" CHECK (NOT "gapAfter" OR "tajweedKind" = 'HUKM'),
  ADD CONSTRAINT "RafiqMistake_tajweed_confused" CHECK ("confusedWith" IS NULL OR ("tajweedKind" = 'MAKHRAJ' AND char_length("confusedWith") = 1)),
  ADD CONSTRAINT "RafiqMistake_tajweed_letter" CHECK (("letterText" IS NOT NULL) = ("letter" > 0));

ALTER TABLE "HomeMistake"
  ADD CONSTRAINT "HomeMistake_tajweed_spot" CHECK ("letter" >= 0 AND NOT ("letter" > 0 AND "gapAfter")),
  ADD CONSTRAINT "HomeMistake_tajweed_detail" CHECK (("tajweedKind" = 'NONE') = ("letter" = 0 AND NOT "gapAfter")),
  ADD CONSTRAINT "HomeMistake_tajweed_type" CHECK ("tajweedKind" = 'NONE' OR "type" = 'TAJWEED'),
  ADD CONSTRAINT "HomeMistake_tajweed_plain" CHECK ("tajweedKind" <> 'NONE' OR ("tajweedCode" = '' AND "confusedWith" IS NULL)),
  ADD CONSTRAINT "HomeMistake_tajweed_gap" CHECK (NOT "gapAfter" OR "tajweedKind" = 'HUKM'),
  ADD CONSTRAINT "HomeMistake_tajweed_confused" CHECK ("confusedWith" IS NULL OR ("tajweedKind" = 'MAKHRAJ' AND char_length("confusedWith") = 1)),
  ADD CONSTRAINT "HomeMistake_tajweed_letter" CHECK (("letterText" IS NOT NULL) = ("letter" > 0));

ALTER TABLE "RafiqHomeMistake"
  ADD CONSTRAINT "RafiqHomeMistake_tajweed_spot" CHECK ("letter" >= 0 AND NOT ("letter" > 0 AND "gapAfter")),
  ADD CONSTRAINT "RafiqHomeMistake_tajweed_detail" CHECK (("tajweedKind" = 'NONE') = ("letter" = 0 AND NOT "gapAfter")),
  ADD CONSTRAINT "RafiqHomeMistake_tajweed_type" CHECK ("tajweedKind" = 'NONE' OR "type" = 'TAJWEED'),
  ADD CONSTRAINT "RafiqHomeMistake_tajweed_plain" CHECK ("tajweedKind" <> 'NONE' OR ("tajweedCode" = '' AND "confusedWith" IS NULL)),
  ADD CONSTRAINT "RafiqHomeMistake_tajweed_gap" CHECK (NOT "gapAfter" OR "tajweedKind" = 'HUKM'),
  ADD CONSTRAINT "RafiqHomeMistake_tajweed_confused" CHECK ("confusedWith" IS NULL OR ("tajweedKind" = 'MAKHRAJ' AND char_length("confusedWith") = 1)),
  ADD CONSTRAINT "RafiqHomeMistake_tajweed_letter" CHECK (("letterText" IS NOT NULL) = ("letter" > 0));
