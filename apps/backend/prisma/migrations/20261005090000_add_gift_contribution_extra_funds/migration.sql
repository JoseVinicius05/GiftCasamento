-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('available', 'partially_funded', 'fully_funded', 'purchased_via_link', 'confirmed');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('pending', 'confirmed', 'expired');

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "product_url" TEXT,
    "title" TEXT NOT NULL,
    "image_url" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "price_source" "PriceSource" NOT NULL,
    "status" "GiftStatus" NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "gift_id" TEXT NOT NULL,
    "guest_display_name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_extra_funds" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "source_gift_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_extra_funds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributions_gift_id_status_idx" ON "contributions"("gift_id", "status");

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "gifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_extra_funds" ADD CONSTRAINT "event_extra_funds_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_extra_funds" ADD CONSTRAINT "event_extra_funds_source_gift_id_fkey" FOREIGN KEY ("source_gift_id") REFERENCES "gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
