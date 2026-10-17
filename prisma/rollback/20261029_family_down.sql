-- «العائلة» — ROLLBACK ONLY. Not a migration: Prisma never reads this folder.
--
-- Undoes 20261028000000_family and 20261029000000_family_children, so the
-- database matches the schema before «العائلة» (rafiq at ed47250). Apply only
-- with explicit approval, by hand (psql or the Neon SQL editor), and only
-- after the code running against this database no longer has «العائلة»
-- (a revert pushed and deployed, or an Instant Rollback to an older build).
--
-- IT DELETES DATA: every family, its children (with all their sessions,
-- trackers and plans — they are RafiqUser rows), invites, family events and
-- the family calendar's adjustments, plus the «العائلة» columns on adults'
-- rows (sharing, who recorded a session). Adults' own Rafiq data is kept.
-- If families exist that must be kept, restore from the pre-family Neon
-- branch instead.
--
-- Afterwards `prisma migrate status` shows the two migrations as not applied,
-- and a later `prisma migrate deploy` applies them again from scratch.

BEGIN;

-- the shape check first: it would block restoring NOT NULL
ALTER TABLE "RafiqUser" DROP CONSTRAINT IF EXISTS "RafiqUser_kind_shape_check";

-- children: RafiqUser rows of kind CHILD (their sessions, plan items,
-- tracker items, notes … go with them by their own ON DELETE CASCADE)
DELETE FROM "RafiqUser" WHERE "kind" = 'CHILD';

-- the family tables (members, invites, events and adjustments first)
DROP TABLE IF EXISTS "FamilyCalendarAdjustment";
DROP TABLE IF EXISTS "FamilyEvent";
DROP TABLE IF EXISTS "FamilyInvite";
DROP TABLE IF EXISTS "FamilyMember";
ALTER TABLE "RafiqUser" DROP CONSTRAINT IF EXISTS "RafiqUser_familyId_fkey";
DROP TABLE IF EXISTS "Family";

-- 20261029000000_family_children
ALTER TABLE "RafiqSession" DROP COLUMN IF EXISTS "qualityByAdult";

-- 20261028000000_family: columns, keys and indexes on existing tables
ALTER TABLE "RafiqSession" DROP CONSTRAINT IF EXISTS "RafiqSession_recordedById_fkey";
ALTER TABLE "RafiqSession" DROP COLUMN IF EXISTS "recordedByAdult",
  DROP COLUMN IF EXISTS "recordedById";

ALTER TABLE "RafiqTrackerItem" DROP CONSTRAINT IF EXISTS "RafiqTrackerItem_createdById_fkey";
ALTER TABLE "RafiqTrackerItem" DROP COLUMN IF EXISTS "adultAdded",
  DROP COLUMN IF EXISTS "createdById";

ALTER TABLE "RafiqUser" DROP CONSTRAINT IF EXISTS "RafiqUser_createdById_fkey";
DROP INDEX IF EXISTS "RafiqUser_childCode_key";
DROP INDEX IF EXISTS "RafiqUser_familyId_idx";
ALTER TABLE "RafiqUser" DROP COLUMN IF EXISTS "childCode",
  DROP COLUMN IF EXISTS "childCodeCreatedAt",
  DROP COLUMN IF EXISTS "childCodeVersion",
  DROP COLUMN IF EXISTS "createdById",
  DROP COLUMN IF EXISTS "familyId",
  DROP COLUMN IF EXISTS "goalEnabled",
  DROP COLUMN IF EXISTS "homeLogEnabled",
  DROP COLUMN IF EXISTS "homeMistakesEnabled",
  DROP COLUMN IF EXISTS "kind",
  DROP COLUMN IF EXISTS "streakEnabled";

-- every remaining row is an adult with all four set (the check guaranteed it)
ALTER TABLE "RafiqUser" ALTER COLUMN "email" SET NOT NULL,
  ALTER COLUMN "passwordHash" SET NOT NULL,
  ALTER COLUMN "recoveryCodeHash" SET NOT NULL,
  ALTER COLUMN "recoveryCodeCreatedAt" SET NOT NULL;

DROP TYPE IF EXISTS "RafiqUserKind";

-- LoginScope without FAMILY_CHILD_LOGIN and FAMILY_JOIN (Postgres can't drop
-- an enum value, so the type is rebuilt; their rate-limit rows go first)
DELETE FROM "LoginAttempt" WHERE "scope"::text IN ('FAMILY_CHILD_LOGIN', 'FAMILY_JOIN');
ALTER TYPE "LoginScope" RENAME TO "LoginScope_old";
CREATE TYPE "LoginScope" AS ENUM ('PARENT', 'BOARD', 'STUDENT', 'ADMIN', 'RAFIQ_LOGIN', 'RAFIQ_ACCOUNT', 'RAFIQ_SIGNUP', 'RAFIQ_RECOVER');
ALTER TABLE "LoginAttempt" ALTER COLUMN "scope" TYPE "LoginScope" USING "scope"::text::"LoginScope";
DROP TYPE "LoginScope_old";

-- Prisma's record of the two migrations
DELETE FROM "_prisma_migrations" WHERE "migration_name" IN ('20261028000000_family', '20261029000000_family_children');

COMMIT;
