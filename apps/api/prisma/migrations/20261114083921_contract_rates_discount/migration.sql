-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "list_price" DECIMAL(12,2),
ADD COLUMN     "sibling_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "protocol_hourly_rate" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "contract_rates" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "hourly_rate" DECIMAL(12,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_rates_teacher_id_contract_id_idx" ON "contract_rates"("teacher_id", "contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_rates_contract_id_teacher_id_effective_from_key" ON "contract_rates"("contract_id", "teacher_id", "effective_from");

-- AddForeignKey
ALTER TABLE "contract_rates" ADD CONSTRAINT "contract_rates_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_rates" ADD CONSTRAINT "contract_rates_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- D-67: хязгаарлалт (Prisma-гаар илэрхийлэхгүй)
ALTER TABLE "contracts"
  ADD CONSTRAINT contracts_sibling_discount_range CHECK (sibling_discount_percent >= 0 AND sibling_discount_percent <= 100);
ALTER TABLE "contract_rates"
  ADD CONSTRAINT contract_rates_hourly_rate_nonneg CHECK (hourly_rate >= 0);
ALTER TABLE "programs"
  ADD CONSTRAINT programs_protocol_rate_nonneg CHECK (protocol_hourly_rate IS NULL OR protocol_hourly_rate >= 0);
