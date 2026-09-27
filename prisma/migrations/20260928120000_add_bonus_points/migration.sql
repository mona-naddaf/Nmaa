-- AlterTable: bonus points are PointsLog rows with no activity and a note.
-- Existing rows all have an activity, so nothing about them changes; the
-- activity foreign key keeps ON DELETE RESTRICT (see schema.prisma).
ALTER TABLE "PointsLog" ADD COLUMN     "note" TEXT,
ALTER COLUMN "activityId" DROP NOT NULL;

-- A bonus row must carry its reason. (Not expressible in the Prisma schema,
-- so it lives here; Prisma leaves CHECK constraints alone.)
ALTER TABLE "PointsLog" ADD CONSTRAINT "PointsLog_bonus_needs_note"
  CHECK ("activityId" IS NOT NULL OR ("note" IS NOT NULL AND length(btrim("note")) > 0));
