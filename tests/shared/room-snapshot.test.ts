import { describe, expect, it } from "vitest";

import {
  roomSnapshotSchema,
  snapshotForAudience,
  type RoomSnapshot,
} from "../../src/shared/room-snapshot";

const snapshot: RoomSnapshot = {
  roomId: "room-1",
  stateVersion: 1,
  roomStatus: "open",
  questions: [
    {
      id: "question-1",
      title: "次のテーマは？",
      status: "draft",
      questionType: "single",
      minChoices: 1,
      maxChoices: 1,
      sortOrder: 0,
      options: [
        {
          id: "option-1",
          label: "D1",
          sortOrder: 0,
        },
      ],
    },
  ],
  resultsByQuestion: {
    "question-1": {
      questionId: "question-1",
      voterCount: 1,
      counts: { "option-1": 1 },
    },
  },
};

describe("RoomSnapshot", () => {
  it("accepts a valid snapshot", () => {
    expect(roomSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("limits participant results to voted questions", () => {
    const participantSnapshot = snapshotForAudience(snapshot, "participant");
    const votedParticipantSnapshot = snapshotForAudience(snapshot, "participant", ["question-1"]);

    expect(participantSnapshot.resultsByQuestion).toEqual({});
    expect(votedParticipantSnapshot.resultsByQuestion).toEqual(snapshot.resultsByQuestion);
    expect(participantSnapshot.questions).toEqual(snapshot.questions);
    expect(snapshotForAudience(snapshot, "host").resultsByQuestion).toEqual(
      snapshot.resultsByQuestion,
    );
  });

  it("hides draft questions from participants after the room closes", () => {
    const closedSnapshot: RoomSnapshot = {
      ...snapshot,
      roomStatus: "closed",
    };

    expect(snapshotForAudience(closedSnapshot, "participant").questions).toEqual([]);
    expect(snapshotForAudience(closedSnapshot, "host").questions).toEqual(snapshot.questions);
  });
});
