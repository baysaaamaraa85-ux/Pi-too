-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentRecordStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" DATE NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "reference" TEXT,
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancel_reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_claims" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "parent_id" UUID NOT NULL,
    "claimed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "reject_reason" TEXT,
    "payment_id" UUID,

    CONSTRAINT "payment_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_contract_id_status_idx" ON "payments"("contract_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_claims_payment_id_key" ON "payment_claims"("payment_id");

-- CreateIndex
CREATE INDEX "payment_claims_status_claimed_at_idx" ON "payment_claims"("status", "claimed_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ФШ-46: төлбөрийн дүн эерэг.
ALTER TABLE "payments" ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

-- ФШ-52: цуцалсан төлбөрт шалтгаан заавал.
ALTER TABLE "payments"
  ADD CONSTRAINT payments_cancel_reason_required
  CHECK (status <> 'CANCELLED' OR (cancel_reason IS NOT NULL AND length(trim(cancel_reason)) > 0));

-- ФШ-76: нэг гэрээнд нэгээс олон хүлээгдэж буй шилжүүлгийн мэдэгдэл үүсэхгүй.
CREATE UNIQUE INDEX payment_claims_one_pending_per_contract
  ON payment_claims (contract_id)
  WHERE status = 'PENDING';
