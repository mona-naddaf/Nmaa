-- The supervisor's stand-in Teacher row (the one supervisor entries are
-- attributed to) was found by its name key, so a teacher logging in under
-- that name landed on it. Mark it explicitly instead. No entry changes: every
-- existing attribution to the stand-in stays exactly as it is.

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "isSupervisorProxy" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the existing stand-ins are exactly the rows with this name key
-- (src/lib/auth/teacher-identity.ts); that name is reserved at login from now on.
UPDATE "Teacher" SET "isSupervisorProxy" = true WHERE "nameKey" = 'مديرة الدورة';

-- At most one stand-in per course. (A partial index isn't expressible in the
-- Prisma schema, so it lives here.)
CREATE UNIQUE INDEX "Teacher_one_supervisor_proxy_per_course" ON "Teacher"("courseId") WHERE "isSupervisorProxy";
