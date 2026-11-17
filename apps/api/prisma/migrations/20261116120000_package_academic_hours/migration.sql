-- D-70: багцыг ирэлтээр биш академик цагаар тооцно (75 цаг). Ирэлт бүр бодит орсон цагаараа (минут / 40) хасагдана.

-- Багцын тоолуур: ирэлт -> академик цаг (хуучин утгыг "нэг ирэлтийн академик цаг"-аар үржүүлнэ).
ALTER TABLE "contracts" DROP CONSTRAINT contracts_remaining_visits_range;
ALTER TABLE "contracts" RENAME COLUMN "total_visits" TO "total_hours";
ALTER TABLE "contracts" RENAME COLUMN "remaining_visits" TO "remaining_hours";
ALTER TABLE "contracts"
  ALTER COLUMN "total_hours" TYPE DECIMAL(7,2),
  ALTER COLUMN "remaining_hours" TYPE DECIMAL(7,2);

-- Ирцийн мөр: бодит эхлэх, дуусах цаг ба багцаас хасагдсан цаг.
ALTER TABLE "attendance"
  ADD COLUMN "actual_starts_at" TIMESTAMPTZ(6),
  ADD COLUMN "actual_ends_at" TIMESTAMPTZ(6),
  ADD COLUMN "package_hours" DECIMAL(7,2) NOT NULL DEFAULT 0;

DO $$
DECLARE
  per  NUMERIC := COALESCE((SELECT (value->>'academicHoursPerVisit')::numeric FROM settings WHERE key = 'contract_defaults'), 3);
  mins NUMERIC := COALESCE((SELECT (value->>'academicHourMinutes')::numeric FROM settings WHERE key = 'contract_defaults'), 40);
BEGIN
  UPDATE contracts SET total_hours = total_hours * per, remaining_hours = remaining_hours * per;
  -- Хуучин ирцүүд: багцаас хасагдсан төлөвтэй мөр хичээлийн хугацаагаар (минут / 40).
  UPDATE attendance a
     SET package_hours = ROUND(EXTRACT(EPOCH FROM (l.ends_at - l.starts_at)) / 60 / mins, 2)
    FROM lessons l
   WHERE l.id = a.lesson_id AND a.status IN ('PRESENT', 'OVER_LIMIT', 'MAKEUP');
END $$;

-- Хязгаарлалт (Prisma-гаар илэрхийлэхгүй).
ALTER TABLE "contracts"
  ADD CONSTRAINT contracts_remaining_hours_range CHECK (remaining_hours >= 0 AND remaining_hours <= total_hours);
ALTER TABLE "attendance"
  ADD CONSTRAINT attendance_actual_time_range CHECK (
    (actual_starts_at IS NULL) = (actual_ends_at IS NULL)
    AND (actual_ends_at IS NULL OR actual_ends_at > actual_starts_at)
  ),
  ADD CONSTRAINT attendance_package_hours_nonneg CHECK (package_hours >= 0);
