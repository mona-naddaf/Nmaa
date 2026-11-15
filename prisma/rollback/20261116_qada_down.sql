-- «القضاء» — ROLLBACK ONLY. Not a migration: Prisma never reads this folder.
--
-- Undoes 20261116000000_qada. Apply only with explicit approval, by hand
-- (psql or the Neon SQL editor), and only after the code running against
-- this database no longer has «القضاء» (a revert pushed and deployed, or an
-- Instant Rollback to an older build).
--
-- IT DELETES DATA: every qada entry, every qada goal and average, and
-- everyone's «القضاء» switch.
--
-- Afterwards `prisma migrate status` shows the migration as not applied, and
-- a later `prisma migrate deploy` applies it again from scratch.

BEGIN;

DROP TABLE IF EXISTS "RafiqQadaEntry";
DROP TABLE IF EXISTS "RafiqQadaPlan";
DROP TYPE IF EXISTS "QadaKind";
DROP TYPE IF EXISTS "QadaAction";
DROP TYPE IF EXISTS "QadaSource";
DROP TYPE IF EXISTS "QadaGoalMode";
ALTER TABLE "RafiqUser" DROP COLUMN IF EXISTS "qadaEnabled";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261116000000_qada';

COMMIT;
