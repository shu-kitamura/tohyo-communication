import { z } from "zod";

import { roomQuestionSchema, roomSnapshotSchema } from "./room-snapshot";

export const mutationRequestHeaderName = "X-TOHYO-Request";
export const mutationRequestHeaderValue = "1";
export const createRoomTurnstileAction = "create_room";

export const questionTypeSchema = z.enum(["single", "multiple"]);

export const createRoomRequestSchema = z.object({
  title: z.string().trim().min(1).max(100),
  adminPassword: z.string().min(8).max(128),
  turnstileToken: z.string().min(1).max(2048),
});

export const createHostSessionRequestSchema = z.object({
  adminPassword: z.string().min(8).max(128),
});

export const createQuestionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  questionType: questionTypeSchema,
  options: z
    .array(z.string().trim().min(1).max(100))
    .min(2)
    .max(10)
    .refine((options) => new Set(options).size === options.length, {
      message: "選択肢は重複しないようにしてください。",
    }),
});

export const submitVoteRequestSchema = z.object({
  optionIds: z
    .array(z.string().min(1))
    .min(1)
    .max(10)
    .refine((optionIds) => new Set(optionIds).size === optionIds.length, {
      message: "同じ選択肢を複数回指定できません。",
    }),
});

export const viewerRoleSchema = z.enum(["host", "guest"]);

export const roomViewerResponseSchema = z.object({
  viewerRole: viewerRoleSchema,
});

export const hostSessionResponseSchema = z.object({
  viewerRole: z.literal("host"),
});

export const hostRoomResponseSchema = z.object({
  room: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    status: z.enum(["open", "closed"]),
    stateVersion: z.number().int().positive(),
  }),
  questions: z.array(roomQuestionSchema),
});

export const participantRoomResponseSchema = z.object({
  title: z.string().min(1),
  snapshot: roomSnapshotSchema,
  votedQuestionIds: z.array(z.string().min(1)),
});

export const publicConfigResponseSchema = z.object({
  turnstileSiteKey: z.string().min(1),
});

export interface ApiError {
  error: string;
  code?: string;
}

export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;
export type CreateHostSessionRequest = z.infer<typeof createHostSessionRequestSchema>;
export type CreateQuestionRequest = z.infer<typeof createQuestionRequestSchema>;
export type SubmitVoteRequest = z.infer<typeof submitVoteRequestSchema>;
export type ViewerRole = z.infer<typeof viewerRoleSchema>;
export type RoomQuestion = z.infer<typeof roomQuestionSchema>;
export type RoomViewerResponse = z.infer<typeof roomViewerResponseSchema>;
export type HostSessionResponse = z.infer<typeof hostSessionResponseSchema>;
export type HostRoomResponse = z.infer<typeof hostRoomResponseSchema>;
export type ParticipantRoomResponse = z.infer<typeof participantRoomResponseSchema>;
export type PublicConfigResponse = z.infer<typeof publicConfigResponseSchema>;
