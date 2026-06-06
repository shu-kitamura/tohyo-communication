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
  results: {
    questionId: "question-1",
    voterCount: 1,
    counts: { "option-1": 1 },
  },
};

describe("RoomSnapshot", () => {
  it("accepts a valid snapshot", () => {
    expect(roomSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("removes results from participant payloads", () => {
    expect(snapshotForAudience(snapshot, "participant")).not.toHaveProperty("results");
    expect(snapshotForAudience(snapshot, "host")).toHaveProperty("results");
  });
});
