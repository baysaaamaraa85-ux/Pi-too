-- D-102: салбарын ахлагч багш, түвшин тогтоох хүсэлтийг хариуцагч багш.
ALTER TABLE "branches" ADD COLUMN "lead_teacher_id" UUID;
ALTER TABLE "placement_requests" ADD COLUMN "assigned_teacher_id" UUID;

CREATE INDEX "branches_lead_teacher_id_idx" ON "branches"("lead_teacher_id");
CREATE INDEX "placement_requests_assigned_teacher_id_status_idx" ON "placement_requests"("assigned_teacher_id", "status");

ALTER TABLE "branches" ADD CONSTRAINT "branches_lead_teacher_id_fkey" FOREIGN KEY ("lead_teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "placement_requests" ADD CONSTRAINT "placement_requests_assigned_teacher_id_fkey" FOREIGN KEY ("assigned_teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
