-- AlterTable
ALTER TABLE "contributions" ADD COLUMN "guest_session_id" TEXT;

-- CreateIndex
CREATE INDEX "contributions_guest_session_id_idx" ON "contributions"("guest_session_id");
