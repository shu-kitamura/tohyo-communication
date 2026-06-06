import { z } from "zod";

export const roomSnapshotSchema = z.object({
  roomId: z.string().min(1),
  stateVersion: z.number().int().positive(),
  roomStatus: z.enum(["open", "closed"]),
  currentQuestion: z
    .object({
      id: z.string().min(1),
      title: z.string().min(1),
      status: z.enum(["draft", "active", "closed"]),
      questionType: z.enum(["single", "multiple"]),
      minChoices: z.number().int().positive(),
      maxChoices: z.number().int().positive(),
      options: z.array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          sortOrder: z.number().int().nonnegative(),
        }),
      ),
    })
    .optional(),
  results: z
    .object({
      questionId: z.string().min(1),
      voterCount: z.number().int().nonnegative(),
      counts: z.record(z.string(), z.number().int().nonnegative()),
    })
    .optional(),
});

export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;

export type SnapshotAudience = "host" | "participant";

export function snapshotForAudience(
  snapshot: RoomSnapshot,
  audience: SnapshotAudience,
): RoomSnapshot {
  if (audience === "host") {
    return snapshot;
  }

  const { results: _results, ...participantSnapshot } = snapshot;
  return participantSnapshot;
}
