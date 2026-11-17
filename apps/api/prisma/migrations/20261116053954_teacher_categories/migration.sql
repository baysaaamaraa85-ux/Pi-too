-- CreateTable
CREATE TABLE "teacher_categories" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_category_students" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_category_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_categories_teacher_id_name_key" ON "teacher_categories"("teacher_id", "name");

-- CreateIndex
CREATE INDEX "teacher_category_students_category_id_idx" ON "teacher_category_students"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_category_students_teacher_id_student_id_key" ON "teacher_category_students"("teacher_id", "student_id");

-- AddForeignKey
ALTER TABLE "teacher_categories" ADD CONSTRAINT "teacher_categories_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_category_students" ADD CONSTRAINT "teacher_category_students_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_category_students" ADD CONSTRAINT "teacher_category_students_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "teacher_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_category_students" ADD CONSTRAINT "teacher_category_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
