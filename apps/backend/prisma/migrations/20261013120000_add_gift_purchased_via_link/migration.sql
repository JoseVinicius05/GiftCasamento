-- AlterTable
ALTER TABLE "gifts" ADD COLUMN     "purchased_via_link_at" TIMESTAMP(3),
ADD COLUMN     "purchased_via_link_by" TEXT;
