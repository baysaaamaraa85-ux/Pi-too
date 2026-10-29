-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "attendance_id" UUID;

-- CreateIndex
CREATE INDEX "ledger_entries_attendance_id_idx" ON "ledger_entries"("attendance_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ADR-017 (ADR-010-ийг хэсэгчлэн орлуулсан): EARNING мөр хичээл бүрт биш, ирцийн
-- (сурагчийн) мөр бүрт нэг байна. lesson_id хэвээр үлдэнэ.

-- Хуучин өгөгдлийн хөрвүүлэлт: хичээлийн нэг EARNING мөрийг тухайн хичээлийн цалинд
-- тооцогдох ирцийн мөрүүдэд (PRESENT, OVER_LIMIT, MAKEUP) тэнцүү хуваана. Нийлбэр
-- өөрчлөгдөхгүй. Ирцийн мөргүй EARNING (хуучин) attendance_id = NULL хэвээр үлдэнэ.
DO $$
DECLARE
  e RECORD;
  att UUID[];
  n INT;
  share NUMERIC(12,2);
  remainder NUMERIC(12,2);
  i INT;
BEGIN
  FOR e IN
    SELECT id, teacher_id, amount, lesson_id, rate_used, note, created_by, created_at
    FROM ledger_entries
    WHERE type = 'EARNING' AND lesson_id IS NOT NULL AND attendance_id IS NULL
  LOOP
    SELECT array_agg(id ORDER BY created_at, id) INTO att
    FROM attendance
    WHERE lesson_id = e.lesson_id AND status IN ('PRESENT', 'OVER_LIMIT', 'MAKEUP');
    n := COALESCE(array_length(att, 1), 0);
    CONTINUE WHEN n = 0;

    share := trunc(e.amount / n, 2);
    remainder := e.amount - share * n;

    -- Нэгдүгээр мөрийг (өөрчлөхгүйгээр хасч болохгүй тул) сууриар нь шинэчилнэ: энэ нь
    -- миграци (superuser) тул зөвшөөрөгдөнө.
    UPDATE ledger_entries SET amount = share + remainder, attendance_id = att[1] WHERE id = e.id;
    FOR i IN 2..n LOOP
      INSERT INTO ledger_entries
        (id, teacher_id, type, amount, lesson_id, attendance_id, rate_used, note, created_by, created_at)
      VALUES
        (gen_random_uuid(), e.teacher_id, 'EARNING', share, e.lesson_id, att[i], e.rate_used,
         e.note, e.created_by, e.created_at);
    END LOOP;
  END LOOP;
END $$;

-- Хуучин: нэг хичээлд нэг EARNING.
DROP INDEX IF EXISTS ledger_entries_one_earning_per_lesson;

-- Шинэ: ирцийн мөр бүрт нэг EARNING.
CREATE UNIQUE INDEX ledger_entries_one_earning_per_attendance
  ON ledger_entries (attendance_id)
  WHERE type = 'EARNING' AND attendance_id IS NOT NULL;
