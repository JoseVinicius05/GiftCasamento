/*
  Warnings:

  - You are about to drop the column `payment_mode` on the `events` table. All the data in the column will be lost.
  - Made the column `pix_key` on table `events` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "payment_mode",
ALTER COLUMN "pix_key" SET NOT NULL;

-- DropEnum
DROP TYPE "PaymentMode";
