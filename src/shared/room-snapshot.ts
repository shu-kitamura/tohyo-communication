import { z } from "zod";

export const roomQuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["draft", "active", "closed"]),
  questionType: z.enum(["single", "multiple"]),
  minChoices: z.number().int().positive(),
  maxChoices: z.number().int().positive(),
  sortOrder: z.number().int().nonnegative(),
  options: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      sortOrder: z.number().int().nonnegative(),
    }),
  ),
});

export const questionResultsSchema = z.object({
  questionId: z.string().min(1),
  voterCount: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
});

export const roomSnapshotSchema = z.object({
  roomId: z.string().min(1),
  stateVersion: z.number().int().positive(),
  roomStatus: z.enum(["open", "closed"]),
  questions: z.array(roomQuestionSchema),
  resultsByQuestion: z.record(z.string(), questionResultsSchema),
});

export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
export type SnapshotQuestion = z.infer<typeof roomQuestionSchema>;
export type QuestionResults = z.infer<typeof questionResultsSchema>;

export type SnapshotAudience = "host" | "participant";

export function snapshotForAudience(
  snapshot: RoomSnapshot,
  audience: SnapshotAudience,
  visibleResultQuestionIds: string[] = [],
): RoomSnapshot {
  if (audience === "host") {
    return snapshot;
  }

  const visibleQuestionIds = new Set(visibleResultQuestionIds);
  const resultsByQuestion = Object.fromEntries(
    Object.entries(snapshot.resultsByQuestion).filter(([questionId]) =>
      visibleQuestionIds.has(questionId),
    ),
  );

  return { ...snapshot, resultsByQuestion };
}
