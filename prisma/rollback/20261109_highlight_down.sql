-- «التظليل» — ROLLBACK ONLY. Not a migration: Prisma never reads this folder.
--
-- Undoes 20261109000000_highlight. Apply only with explicit approval, by
-- hand (psql or the Neon SQL editor), and only after the code running
-- against this database no longer has «التظليل» (a revert pushed and
-- deployed, or an Instant Rollback to an older build).
--
-- IT DELETES DATA: every highlight, every highlight colour and name, and
-- the children's «التظليل» switches.
--
-- Afterwards `prisma migrate status` shows the migration as not applied, and
-- a later `prisma migrate deploy` applies it again from scratch.

BEGIN;

DROP TABLE IF EXISTS "RafiqHighlight";
DROP TABLE IF EXISTS "RafiqHighlightColor";
ALTER TABLE "RafiqUser" DROP COLUMN IF EXISTS "highlightEnabled";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261109000000_highlight';

COMMIT;
