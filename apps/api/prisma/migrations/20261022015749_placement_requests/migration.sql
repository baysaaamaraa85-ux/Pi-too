-- CreateEnum
CREATE TYPE "PlacementRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'SCHEDULED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "placement_requests" (
    "id" UUID NOT NULL,
    "student_name" TEXT NOT NULL,
    "school" TEXT,
    "grade" TEXT,
    "phone" TEXT NOT NULL,
    "program_interest" TEXT,
    "branch_id" UUID,
    "status" "PlacementRequestStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "placement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placement_requests_status_created_at_idx" ON "placement_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "placement_requests" ADD CONSTRAINT "placement_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
