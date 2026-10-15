-- «المتشابهات» (src/lib/mutashabihat): marks on verses that have similar
-- verses elsewhere. Additive only: two course switches (teachers and the
-- supervisor; students) and one «رفيق الحفظ» switch, all false by default,
-- so nothing changes for anyone until a supervisor or a user turns one on.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "mutashabihatStudentsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mutashabihatTeachersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RafiqUser" ADD COLUMN     "mutashabihatEnabled" BOOLEAN NOT NULL DEFAULT false;
