import { z } from "zod";

// М6 Сургалтын явц (ФШ-38...45).

export const AssessmentType = {
  PLACEMENT: "PLACEMENT",
  QUIZ: "QUIZ",
  BATCH_EXAM: "BATCH_EXAM",
} as const;
export type AssessmentType = (typeof AssessmentType)[keyof typeof AssessmentType];

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  PLACEMENT: "Түвшин тогтоох",
  QUIZ: "Сорил",
  BATCH_EXAM: "Багцын шалгалт",
};

const percent = z.number().min(0, "0-ээс бага байж болохгүй").max(100, "100-аас их байж болохгүй");

// ФШ-38: огноо, төрөл, нийт хувь, сэдэв тус бүрийн оноо. Сэдвийн оноо өгвөл нийт хувь
// түүний дундаж (давхар шалгагдана), өгөөгүй бол нийт хувь заавал.
export const recordAssessmentSchema = z
  .object({
    type: z.enum(["PLACEMENT", "QUIZ", "BATCH_EXAM"]),
    contractId: z.uuid().optional(),
    takenOn: z.iso.date(),
    totalPercent: percent.optional(),
    topics: z
      .array(z.object({ topic: z.string().trim().min(1, "Сэдвийн нэр шаардлагатай").max(120), scorePercent: percent }))
      .max(30)
      .optional(),
  })
  .refine((v) => v.totalPercent !== undefined || (v.topics?.length ?? 0) > 0, {
    message: "Нийт хувь эсвэл сэдвийн оноо шаардлагатай",
    path: ["totalPercent"],
  })
  .refine((v) => v.type === "PLACEMENT" || v.contractId !== undefined, {
    message: "Сорил, шалгалтыг гэрээнд холбоно",
    path: ["contractId"],
  });
export type RecordAssessmentInput = z.infer<typeof recordAssessmentSchema>;

export const NoteVisibility = { INTERNAL: "INTERNAL", SHARED: "SHARED" } as const;
export type NoteVisibility = (typeof NoteVisibility)[keyof typeof NoteVisibility];

export const NOTE_VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  INTERNAL: "Дотоод",
  SHARED: "Хуваалцсан",
};

// ФШ-44
export const createNoteSchema = z.object({
  contractId: z.uuid(),
  visibility: z.enum(["INTERNAL", "SHARED"]),
  body: z.string().trim().min(1, "Тэмдэглэл хоосон байж болохгүй").max(2000),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  visibility: z.enum(["INTERNAL", "SHARED"]).optional(),
  body: z.string().trim().min(1).max(2000).optional(),
});
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// ФШ-45
export const createMeetingSchema = z.object({
  metOn: z.iso.date(),
  summary: z.string().trim().min(1, "Дүгнэлт шаардлагатай").max(2000),
});
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export interface AssessmentDto {
  id: string;
  type: AssessmentType;
  takenOn: string;
  totalPercent: string;
  contractId: string | null;
  programName: string | null;
  topics: { topic: string; scorePercent: string }[];
}

export interface WeakTopicDto {
  topic: string;
  scorePercent: string;
  takenOn: string;
}

export interface ProgressDto {
  assessments: AssessmentDto[];
  weakTopics: WeakTopicDto[];
  weakTopicThresholdPercent: number;
}

export interface NoteDto {
  id: string;
  lessonId: string;
  lessonStartsAt: string;
  visibility: NoteVisibility;
  body: string;
  authorName: string;
  createdAt: string;
}
