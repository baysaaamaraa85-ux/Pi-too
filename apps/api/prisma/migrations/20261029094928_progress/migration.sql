-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('INTERNAL', 'SHARED');

-- CreateTable
CREATE TABLE "assessment_topics" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "score_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_notes" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "visibility" "NoteVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_meetings" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "met_on" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_topics_assessment_id_idx" ON "assessment_topics"("assessment_id");

-- CreateIndex
CREATE INDEX "lesson_notes_contract_id_created_at_idx" ON "lesson_notes"("contract_id", "created_at");

-- CreateIndex
CREATE INDEX "parent_meetings_contract_id_idx" ON "parent_meetings"("contract_id");

-- AddForeignKey
ALTER TABLE "assessment_topics" ADD CONSTRAINT "assessment_topics_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_notes" ADD CONSTRAINT "lesson_notes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_notes" ADD CONSTRAINT "lesson_notes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_notes" ADD CONSTRAINT "lesson_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_meetings" ADD CONSTRAINT "parent_meetings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_meetings" ADD CONSTRAINT "parent_meetings_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ФШ-38: сэдвийн оноо 0-100 хувь (assessments.total_percent-тэй адил).
ALTER TABLE "assessment_topics"
  ADD CONSTRAINT assessment_topics_score_percent_range CHECK (score_percent >= 0 AND score_percent <= 100);
