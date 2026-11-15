-- «القضاء» Phase 2 — ROLLBACK ONLY. Not a migration: Prisma never reads this folder.
--
-- Undoes 20261117000000_qada2. Apply only with explicit approval, by hand
-- (psql or the Neon SQL editor), and only after the code running against
-- this database no longer has Phase 2 (a revert pushed and deployed, or an
-- Instant Rollback to an older build).
--
-- IT DELETES DATA: every tracker item's link to qada, the answered Ramadan
-- offers and the «استعمال رقمي أنا» choices. Entries already added (from
-- ticks or a Ramadan offer) stay in «السجل» as they are.
--
-- Afterwards `prisma migrate status` shows the migration as not applied, and
-- a later `prisma migrate deploy` applies it again from scratch.

BEGIN;

ALTER TABLE "RafiqTrackerItem" DROP COLUMN IF EXISTS "qadaKind";
ALTER TABLE "RafiqQadaPlan" DROP COLUMN IF EXISTS "ramadanSeen";
ALTER TABLE "RafiqQadaPlan" DROP COLUMN IF EXISTS "ownAverage";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261117000000_qada2';

COMMIT;
