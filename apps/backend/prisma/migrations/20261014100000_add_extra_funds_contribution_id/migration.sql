-- AlterTable
ALTER TABLE "event_extra_funds" ADD COLUMN     "contribution_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "event_extra_funds_contribution_id_key" ON "event_extra_funds"("contribution_id");

-- AddForeignKey
ALTER TABLE "event_extra_funds" ADD CONSTRAINT "event_extra_funds_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
