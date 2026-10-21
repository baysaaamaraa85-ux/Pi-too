-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('PLACEMENT', 'QUIZ', 'BATCH_EXAM');

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "contract_id" UUID,
    "type" "AssessmentType" NOT NULL,
    "taken_on" DATE NOT NULL,
    "total_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_student_id_idx" ON "assessments"("student_id");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
