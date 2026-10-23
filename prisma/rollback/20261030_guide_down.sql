-- In-site guidance — ROLLBACK ONLY. Not a migration: Prisma never reads this folder.
--
-- Undoes 20261030000000_guide. Apply only with explicit approval, by hand
-- (psql or the Neon SQL editor), and only after the code running against
-- this database no longer reads "guideNewAt" / "GuideState".
--
-- It deletes guidance state only (finished setup questions, dismissed
-- welcome / intro lines, the checklist); no memorization or tracker data.

BEGIN;
DROP TABLE IF EXISTS "GuideState";
ALTER TABLE "RafiqUser" DROP COLUMN IF EXISTS "guideNewAt";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261030000000_guide';
COMMIT;
