-- CLAUDE.md 7-р хэсэг: Prisma схемоор илэрхийлэгдэхгүй хязгаарлалтууд.

-- ФБШ-24: аппликейшний DB хэрэглэгч audit_log, ledger_entries хоёрт UPDATE,
-- DELETE хийх боломжгүй байх ёстой (зөвхөн нэмэгддэг). Хөгжүүлэлтийн орчинд
-- migration-ууд postgres superuser-ээр ажилладаг тул тусдаа pitoo_app
-- хэрэглэгч үүсгэж, аппликейшн зөвхөн түүгээр холбогдоно (src/shared/db/prisma.ts,
-- APP_DATABASE_URL). Нууц үгийг зөвхөн хөгжүүлэлтийн орчинд ийм энгийн үлдэнэ.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pitoo_app') THEN
    CREATE ROLE pitoo_app LOGIN PASSWORD 'pitoo_app_dev';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE pitoo TO pitoo_app;
GRANT USAGE ON SCHEMA public TO pitoo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pitoo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pitoo_app;

-- ФШ-35, 52, ФБШ-24: аудит, цалингийн гүйлгээ зөвхөн нэмэгддэг.
REVOKE UPDATE, DELETE ON audit_log FROM pitoo_app;
REVOKE UPDATE, DELETE ON ledger_entries FROM pitoo_app;

-- contracts: тоолуур 0-ээс доош, totalVisits-ээс дээш болохгүй (ADR-009).
ALTER TABLE contracts
  ADD CONSTRAINT contracts_remaining_visits_range
    CHECK (remaining_visits >= 0 AND remaining_visits <= total_visits),
  ADD CONSTRAINT contracts_leaves_left_non_negative
    CHECK (leaves_left >= 0),
  ADD CONSTRAINT contracts_free_reviews_left_non_negative
    CHECK (free_reviews_left >= 0);

-- lessons: нэг багш нэг мөчид хоёр хичээлд давхацахгүй, цуцлагдсан хичээл
-- тооцогдохгүй (ФШ-25).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE lessons
  ADD CONSTRAINT lessons_no_teacher_overlap
    EXCLUDE USING gist (
      teacher_id WITH =,
      tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (status <> 'CANCELLED');

-- ledger_entries: нэг хичээлд хоёр EARNING мөр бичигдэхгүй (ADR-010).
CREATE UNIQUE INDEX ledger_entries_one_earning_per_lesson
  ON ledger_entries (lesson_id)
  WHERE type = 'EARNING';

-- contract_pauses: нэг гэрээнд нэг л идэвхтэй (дуусаагаагүй) зогсолт (ADR-014).
CREATE UNIQUE INDEX contract_pauses_one_active_per_contract
  ON contract_pauses (contract_id)
  WHERE ended_on IS NULL;

-- enrollments: нэг гэрээ нэг ангид нэг л идэвхтэй бүртгэлтэй (ФШ-20, 21, 70).
CREATE UNIQUE INDEX enrollments_one_active_per_contract_class
  ON enrollments (contract_id, class_id)
  WHERE to_date IS NULL;
