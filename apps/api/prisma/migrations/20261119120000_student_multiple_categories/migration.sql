-- D-98: нэг сурагч багшийн 2 категорид байж болно (дээд хязгаарыг service шалгана).
-- Өмнө нь (багш, сурагч) хосод UNIQUE байсан тул 1 категори л байдаг байв. Одоо (категори, сурагч)
-- хос давхардахгүй байх нь л хангалттай (категори нь нэг багшийнх тул багш давхцахгүй).
DROP INDEX "teacher_category_students_teacher_id_student_id_key";

CREATE UNIQUE INDEX "teacher_category_students_category_id_student_id_key" ON "teacher_category_students"("category_id", "student_id");

CREATE INDEX "teacher_category_students_teacher_id_student_id_idx" ON "teacher_category_students"("teacher_id", "student_id");
