-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('redirect_link', 'pix_key');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('casamento', 'aniversario', 'cha_de_bebe', 'cha_de_cozinha', 'outro');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "slug" TEXT NOT NULL,
    "guest_password_hash" TEXT NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "pix_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
