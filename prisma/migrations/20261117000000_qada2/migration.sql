-- «القضاء» Phase 2 (src/lib/qada). Additive only: no item is linked to qada,
-- no Ramadan offer has been answered, and nobody has chosen her own average
-- over a prediction — nothing changes until someone uses them. Undo with
-- prisma/rollback/20261117_qada2_down.sql.

-- AlterTable
ALTER TABLE "RafiqTrackerItem" ADD COLUMN     "qadaKind" "QadaKind";

-- AlterTable
ALTER TABLE "RafiqQadaPlan" ADD COLUMN     "ownAverage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ramadanSeen" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
