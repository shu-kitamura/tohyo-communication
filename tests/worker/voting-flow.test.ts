import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { mutationRequestHeaderName, mutationRequestHeaderValue } from "../../src/shared/api";

interface TestEnv extends Env {
  TEST_MIGRATIONS: Array<{
    name: string;
    queries: string[];
  }>;
}

interface CreatedQuestion {
  id: string;
  options: Array<{ id: string }>;
}

const testEnv = env as TestEnv;
const requestOrigin = "https://example.com";
const roomIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("voting flow", () => {
  beforeEach(async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
  });

  it("runs multiple active questions and closes them independently", async () => {
    const createRoomResponse = await SELF.fetch("https://example.com/api/rooms", {
      body: JSON.stringify({
        title: "テスト投票",
        adminPassword: "password123",
        turnstileToken: "test-token",
      }),
      headers: mutationHeaders({ "Content-Type": "application/json" }),
      method: "POST",
    });

    expect(createRoomResponse.status).toBe(201);
    const room = await createRoomResponse.json<{
      roomId: string;
      hostUrl: string;
      participantUrl: string;
    }>();
    const hostCookie = readCookie(createRoomResponse);
    expect(room.roomId).toMatch(roomIdPattern);
    expect(room.hostUrl).toBe(`/rooms/${room.roomId}`);
    expect(room.participantUrl).toBe(`/rooms/${room.roomId}`);

    const guestViewerResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/viewer`,
    );
    await expect(guestViewerResponse.json()).resolves.toEqual({ viewerRole: "guest" });

    const hostViewerResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/viewer`,
      {
        headers: { Cookie: hostCookie },
      },
    );
    await expect(hostViewerResponse.json()).resolves.toEqual({ viewerRole: "host" });

    const invalidHostSessionResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/host-session`,
      {
        body: JSON.stringify({ adminPassword: "wrong-password" }),
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    expect(invalidHostSessionResponse.status).toBe(401);
    await expect(invalidHostSessionResponse.json()).resolves.toMatchObject({
      code: "invalid_admin_password",
    });

    const promotedHostSessionResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/host-session`,
      {
        body: JSON.stringify({ adminPassword: "password123" }),
        headers: mutationHeaders({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    expect(promotedHostSessionResponse.status).toBe(201);
    const promotedHostCookie = readCookie(promotedHostSessionResponse);
    const promotedViewerResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/viewer`,
      {
        headers: { Cookie: promotedHostCookie },
      },
    );
    await expect(promotedViewerResponse.json()).resolves.toEqual({ viewerRole: "host" });

    const duplicateOptionsResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/questions`,
      {
        body: JSON.stringify({
          title: "重複選択肢の質問",
          questionType: "single",
          options: ["D1", "D1"],
        }),
        headers: mutationHeaders({
          "Content-Type": "application/json",
          Cookie: hostCookie,
        }),
        method: "POST",
      },
    );

    expect(duplicateOptionsResponse.status).toBe(400);
    await expect(duplicateOptionsResponse.json()).resolves.toEqual({
      error: "選択肢は重複しないようにしてください。",
      code: "validation_error",
    });

    const firstQuestion = await createQuestion(room.roomId, hostCookie, {
      title: "次に扱いたいテーマは？",
      questionType: "single",
      options: ["D1", "Durable Objects"],
    });
    const secondQuestion = await createQuestion(room.roomId, hostCookie, {
      title: "満足度は？",
      questionType: "single",
      options: ["満足", "不満"],
    });

    const waitingParticipantResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}`,
    );
    const participantCookie = readCookie(waitingParticipantResponse);
    const waitingParticipantRoom = await waitingParticipantResponse.json<{
      votedQuestionIds: string[];
      snapshot: {
        questions: Array<{ id: string; status: string }>;
        resultsByQuestion: Record<string, unknown>;
      };
    }>();

    expect(waitingParticipantRoom.votedQuestionIds).toEqual([]);
    expect(waitingParticipantRoom.snapshot.questions).toEqual([
      expect.objectContaining({ id: firstQuestion.id, status: "draft" }),
      expect.objectContaining({ id: secondQuestion.id, status: "draft" }),
    ]);
    expect(waitingParticipantRoom.snapshot.resultsByQuestion).toEqual({});

    const firstStartResponse = await startQuestion(room.roomId, firstQuestion.id, hostCookie);
    const secondStartResponse = await startQuestion(room.roomId, secondQuestion.id, hostCookie);

    expect(firstStartResponse.status).toBe(200);
    expect(secondStartResponse.status).toBe(200);

    const activeParticipantResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}`,
      {
        headers: { Cookie: participantCookie },
      },
    );
    const activeParticipantRoom = await activeParticipantResponse.json<{
      snapshot: {
        questions: Array<{ id: string; status: string }>;
        resultsByQuestion: Record<string, unknown>;
      };
    }>();

    expect(
      activeParticipantRoom.snapshot.questions.filter((question) => question.status === "active"),
    ).toHaveLength(2);
    expect(activeParticipantRoom.snapshot.resultsByQuestion).toEqual({});

    const firstVoteUrl = `https://example.com/api/rooms/${room.roomId}/questions/${firstQuestion.id}/votes`;
    const firstVoteBody = JSON.stringify({
      optionIds: [firstQuestion.options[0].id],
    });
    const firstVoteResponse = await SELF.fetch(firstVoteUrl, {
      body: firstVoteBody,
      headers: mutationHeaders({
        "Content-Type": "application/json",
        Cookie: participantCookie,
      }),
      method: "POST",
    });

    expect(firstVoteResponse.status).toBe(201);
    const firstVoteResult = await firstVoteResponse.json<{
      votedQuestionIds: string[];
      snapshot: {
        resultsByQuestion: Record<
          string,
          {
            voterCount: number;
            counts: Record<string, number>;
          }
        >;
      };
    }>();
    expect(firstVoteResult.votedQuestionIds).toEqual([firstQuestion.id]);
    expect(Object.keys(firstVoteResult.snapshot.resultsByQuestion)).toEqual([firstQuestion.id]);
    expect(firstVoteResult.snapshot.resultsByQuestion[firstQuestion.id]).toMatchObject({
      voterCount: 1,
      counts: {
        [firstQuestion.options[0].id]: 1,
        [firstQuestion.options[1].id]: 0,
      },
    });

    const duplicateVoteResponse = await SELF.fetch(firstVoteUrl, {
      body: firstVoteBody,
      headers: mutationHeaders({
        "Content-Type": "application/json",
        Cookie: participantCookie,
      }),
      method: "POST",
    });

    expect(duplicateVoteResponse.status).toBe(409);
    await expect(duplicateVoteResponse.json()).resolves.toMatchObject({
      code: "already_voted",
    });

    const closeResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/questions/${firstQuestion.id}/close`,
      {
        headers: mutationHeaders({ Cookie: hostCookie }),
        method: "POST",
      },
    );

    expect(closeResponse.status).toBe(200);
    const closedQuestionResult = await closeResponse.json<{
      snapshot: {
        questions: Array<{ id: string; status: string }>;
        resultsByQuestion: Record<string, { voterCount: number }>;
      };
    }>();
    expect(closedQuestionResult.snapshot.questions).toEqual([
      expect.objectContaining({ id: firstQuestion.id, status: "closed" }),
      expect.objectContaining({ id: secondQuestion.id, status: "active" }),
    ]);
    expect(closedQuestionResult.snapshot.resultsByQuestion[firstQuestion.id]?.voterCount).toBe(1);

    const voteAfterCloseResponse = await SELF.fetch(firstVoteUrl, {
      body: firstVoteBody,
      headers: mutationHeaders({
        "Content-Type": "application/json",
        Cookie: participantCookie,
      }),
      method: "POST",
    });
    expect(voteAfterCloseResponse.status).toBe(409);
    await expect(voteAfterCloseResponse.json()).resolves.toMatchObject({
      error: "この質問は投票を受け付けていません。",
    });

    const secondVoteResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/questions/${secondQuestion.id}/votes`,
      {
        body: JSON.stringify({ optionIds: [secondQuestion.options[0].id] }),
        headers: mutationHeaders({
          "Content-Type": "application/json",
          Cookie: participantCookie,
        }),
        method: "POST",
      },
    );
    expect(secondVoteResponse.status).toBe(201);
    const secondVoteResult = await secondVoteResponse.json<{
      votedQuestionIds: string[];
      snapshot: { resultsByQuestion: Record<string, unknown> };
    }>();
    expect(secondVoteResult.votedQuestionIds).toEqual([firstQuestion.id, secondQuestion.id]);
    expect(Object.keys(secondVoteResult.snapshot.resultsByQuestion)).toEqual([
      firstQuestion.id,
      secondQuestion.id,
    ]);

    const storedVotes = await testEnv.DB.prepare(
      "SELECT COUNT(*) AS voteCount FROM votes WHERE voter_key_hash IS NOT NULL",
    ).first<{ voteCount: number }>();
    expect(storedVotes?.voteCount).toBe(2);

    const closeRoomResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/close`,
      {
        headers: mutationHeaders({ Cookie: hostCookie }),
        method: "POST",
      },
    );
    expect(closeRoomResponse.status).toBe(200);
    const closedRoom = await closeRoomResponse.json<{
      snapshot: {
        roomStatus: string;
        stateVersion: number;
        questions: Array<{ id: string; status: string }>;
      };
    }>();
    expect(closedRoom.snapshot.roomStatus).toBe("closed");
    expect(closedRoom.snapshot.questions).toEqual([
      expect.objectContaining({ id: firstQuestion.id, status: "closed" }),
      expect.objectContaining({ id: secondQuestion.id, status: "closed" }),
    ]);

    const participantAfterRoomCloseResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}`,
      {
        headers: { Cookie: participantCookie },
      },
    );
    const participantAfterRoomClose = await participantAfterRoomCloseResponse.json<{
      snapshot: { roomStatus: string };
    }>();
    expect(participantAfterRoomClose.snapshot.roomStatus).toBe("closed");

    const createQuestionAfterCloseResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/questions`,
      {
        body: JSON.stringify({
          title: "終了後の質問",
          questionType: "single",
          options: ["A", "B"],
        }),
        headers: mutationHeaders({
          "Content-Type": "application/json",
          Cookie: hostCookie,
        }),
        method: "POST",
      },
    );
    expect(createQuestionAfterCloseResponse.status).toBe(409);
    const versionAfterRejectedQuestion = await testEnv.DB.prepare(
      "SELECT state_version AS stateVersion FROM rooms WHERE id = ?",
    )
      .bind(room.roomId)
      .first<{ stateVersion: number }>();
    expect(versionAfterRejectedQuestion?.stateVersion).toBe(closedRoom.snapshot.stateVersion);

    const duplicateCloseResponse = await SELF.fetch(
      `https://example.com/api/rooms/${room.roomId}/close`,
      {
        headers: mutationHeaders({ Cookie: hostCookie }),
        method: "POST",
      },
    );
    expect(duplicateCloseResponse.status).toBe(409);
    await expect(duplicateCloseResponse.json()).resolves.toMatchObject({
      code: "room_already_closed",
    });
  });

  it("rejects unsafe requests without valid same-origin headers", async () => {
    const requestBody = JSON.stringify({
      title: "不正リクエスト",
      adminPassword: "password123",
    });
    const crossOriginResponse = await SELF.fetch("https://example.com/api/rooms", {
      body: requestBody,
      headers: mutationHeaders({
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      }),
      method: "POST",
    });
    const missingFetchMetadataResponse = await SELF.fetch("https://example.com/api/rooms", {
      body: requestBody,
      headers: {
        "Content-Type": "application/json",
        Origin: requestOrigin,
        [mutationRequestHeaderName]: mutationRequestHeaderValue,
      },
      method: "POST",
    });
    const missingMutationHeaderResponse = await SELF.fetch("https://example.com/api/rooms", {
      body: requestBody,
      headers: {
        "Content-Type": "application/json",
        Origin: requestOrigin,
        "Sec-Fetch-Site": "same-origin",
      },
      method: "POST",
    });

    for (const response of [
      crossOriginResponse,
      missingFetchMetadataResponse,
      missingMutationHeaderResponse,
    ]) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        code: "invalid_request_origin",
      });
    }
  });

  it("rejects oversized and non-JSON request bodies before validation", async () => {
    const oversizedResponse = await SELF.fetch("https://example.com/api/rooms", {
      body: JSON.stringify({
        title: "x".repeat(20 * 1024),
        adminPassword: "password123",
      }),
      headers: mutationHeaders({ "Content-Type": "application/json" }),
      method: "POST",
    });
    const unsupportedMediaTypeResponse = await SELF.fetch("https://example.com/api/rooms", {
      body: JSON.stringify({
        title: "Content-Typeテスト",
        adminPassword: "password123",
      }),
      headers: mutationHeaders({ "Content-Type": "text/plain" }),
      method: "POST",
    });

    expect(oversizedResponse.status).toBe(413);
    await expect(oversizedResponse.json()).resolves.toMatchObject({
      code: "request_body_too_large",
    });
    expect(unsupportedMediaTypeResponse.status).toBe(415);
    await expect(unsupportedMediaTypeResponse.json()).resolves.toMatchObject({
      code: "unsupported_media_type",
    });
  });
});

async function createQuestion(
  roomId: string,
  hostCookie: string,
  question: {
    title: string;
    questionType: "single" | "multiple";
    options: string[];
  },
): Promise<CreatedQuestion> {
  const response = await SELF.fetch(`https://example.com/api/rooms/${roomId}/questions`, {
    body: JSON.stringify(question),
    headers: mutationHeaders({
      "Content-Type": "application/json",
      Cookie: hostCookie,
    }),
    method: "POST",
  });

  expect(response.status).toBe(201);
  const body = await response.json<{ question: CreatedQuestion }>();
  return body.question;
}

function startQuestion(roomId: string, questionId: string, hostCookie: string): Promise<Response> {
  return SELF.fetch(`https://example.com/api/rooms/${roomId}/questions/${questionId}/start`, {
    headers: mutationHeaders({ Cookie: hostCookie }),
    method: "POST",
  });
}

function mutationHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    Origin: requestOrigin,
    "Sec-Fetch-Site": "same-origin",
    [mutationRequestHeaderName]: mutationRequestHeaderValue,
    ...headers,
  };
}

function readCookie(response: Response): string {
  const setCookie = response.headers.get("Set-Cookie");

  if (!setCookie) {
    throw new Error("Set-Cookie header was not returned");
  }

  return setCookie.split(";", 1)[0];
}
