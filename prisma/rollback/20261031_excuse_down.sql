-- «أيام العذر» — ROLLBACK ONLY. Not a migration: Prisma never reads this folder.
--
-- Undoes 20261031000000_excuse. Apply only with explicit approval, by hand
-- (psql or the Neon SQL editor), and only after the code running against
-- this database no longer has «أيام العذر» (a revert pushed and deployed, or
-- an Instant Rollback to an older build).
--
-- IT DELETES DATA: every excuse (courses and «رفيق الحفظ»), its pauses, the
-- family's per-adult viewer choices, the items' excuse settings and the
-- switches. Attendance marked «معذورة» (EXCUSED) becomes «غائبة» (OUT), the
-- only status that existed before; no attendance row is deleted.
--
-- Afterwards `prisma migrate status` shows the migration as not applied, and
-- a later `prisma migrate deploy` applies it again from scratch.

BEGIN;

-- «معذورة» → «غائبة», then rebuild the enum without EXCUSED (Postgres can't
-- drop one value)
UPDATE "AttendanceLog" SET "status" = 'OUT' WHERE "status" = 'EXCUSED';
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
CREATE TYPE "AttendanceStatus" AS ENUM ('IN', 'OUT', 'PENDING');
ALTER TABLE "AttendanceLog"
  ALTER COLUMN "status" TYPE "AttendanceStatus" USING ("status"::text::"AttendanceStatus");
DROP TYPE "AttendanceStatus_old";

-- the excuse tables (pauses first)
DROP TABLE IF EXISTS "RafiqExcusePause";
DROP TABLE IF EXISTS "RafiqExcuse";
DROP TABLE IF EXISTS "StudentExcuse";
DROP TABLE IF EXISTS "FamilyExcuseViewer";

-- the items' excuse settings
ALTER TABLE "TrackerItem" DROP CONSTRAINT IF EXISTS "TrackerItem_excuse_alt_check";
ALTER TABLE "TrackerItem" DROP COLUMN IF EXISTS "excuseMode",
  DROP COLUMN IF EXISTS "excuseAltTitle";
ALTER TABLE "RafiqTrackerItem" DROP CONSTRAINT IF EXISTS "RafiqTrackerItem_excuse_alt_check";
ALTER TABLE "RafiqTrackerItem" DROP COLUMN IF EXISTS "excuseMode",
  DROP COLUMN IF EXISTS "excuseAltTitle";

-- the switches
ALTER TABLE "Course" DROP COLUMN IF EXISTS "excuseEnabled";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "excuseParentVisible";
ALTER TABLE "RafiqUser" DROP COLUMN IF EXISTS "excuseEnabled";

DROP TYPE IF EXISTS "ExcuseMode";
DROP TYPE IF EXISTS "ExcuseActor";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261031000000_excuse';
COMMIT;
