import type { HostRoomResponse, RoomQuestion } from "../shared/api";
import type { QuestionResults, RoomSnapshot, SnapshotQuestion } from "../shared/room-snapshot";

interface RoomRow {
  id: string;
  title: string;
  status: "open" | "closed";
  stateVersion: number;
}

interface QuestionRow {
  id: string;
  title: string;
  questionType: "single" | "multiple";
  status: "draft" | "active" | "closed";
  minChoices: number;
  maxChoices: number;
  sortOrder: number;
}

interface OptionRow {
  id: string;
  questionId: string;
  label: string;
  sortOrder: number;
}

interface CountRow {
  questionId: string;
  optionId: string;
  voteCount: number;
}

interface VoterCountRow {
  questionId: string;
  voterCount: number;
}

export async function getHostRoom(
  database: D1Database,
  roomId: string,
): Promise<HostRoomResponse | null> {
  const [roomResult, questionResult, optionResult] = await database.batch([
    database
      .prepare(
        `SELECT id, title, status, state_version AS stateVersion
         FROM rooms
         WHERE id = ?`,
      )
      .bind(roomId),
    database
      .prepare(
        `SELECT
           id,
           title,
           question_type AS questionType,
           status,
           min_choices AS minChoices,
           max_choices AS maxChoices,
           sort_order AS sortOrder
         FROM questions
         WHERE room_id = ?
         ORDER BY sort_order ASC`,
      )
      .bind(roomId),
    database
      .prepare(
        `SELECT
           o.id,
           o.question_id AS questionId,
           o.label,
           o.sort_order AS sortOrder
         FROM options o
         INNER JOIN questions q ON q.id = o.question_id
         WHERE q.room_id = ?
         ORDER BY q.sort_order ASC, o.sort_order ASC`,
      )
      .bind(roomId),
  ]);

  const room = roomResult.results[0] as RoomRow | undefined;

  if (!room) {
    return null;
  }

  const optionsByQuestion = new Map<string, RoomQuestion["options"]>();

  for (const option of optionResult.results as unknown as OptionRow[]) {
    const questionOptions = optionsByQuestion.get(option.questionId) ?? [];
    questionOptions.push({
      id: option.id,
      label: option.label,
      sortOrder: option.sortOrder,
    });
    optionsByQuestion.set(option.questionId, questionOptions);
  }

  const questions = (questionResult.results as unknown as QuestionRow[]).map((question) => ({
    ...question,
    options: optionsByQuestion.get(question.id) ?? [],
  }));

  return { room, questions };
}

export async function getRoomSnapshot(
  database: D1Database,
  roomId: string,
): Promise<{ title: string; snapshot: RoomSnapshot } | null> {
  const [roomResult, questionResult, optionResult, countResult, voterCountResult] =
    await database.batch([
      database
        .prepare(
          `SELECT id, title, status, state_version AS stateVersion
           FROM rooms
           WHERE id = ?`,
        )
        .bind(roomId),
      database
        .prepare(
          `SELECT
             id,
             title,
             question_type AS questionType,
             status,
             min_choices AS minChoices,
             max_choices AS maxChoices,
             sort_order AS sortOrder
           FROM questions
           WHERE room_id = ?
           ORDER BY sort_order ASC`,
        )
        .bind(roomId),
      database
        .prepare(
          `SELECT
             o.id,
             o.question_id AS questionId,
             o.label,
             o.sort_order AS sortOrder
           FROM options o
           INNER JOIN questions q ON q.id = o.question_id
           WHERE q.room_id = ? AND o.is_enabled = 1
           ORDER BY q.sort_order ASC, o.sort_order ASC`,
        )
        .bind(roomId),
      database
        .prepare(
          `SELECT
             q.id AS questionId,
             o.id AS optionId,
             COUNT(vc.option_id) AS voteCount
           FROM options o
           INNER JOIN questions q ON q.id = o.question_id
           LEFT JOIN vote_choices vc ON vc.option_id = o.id
           WHERE q.room_id = ? AND q.status IN ('active', 'closed')
           GROUP BY q.id, q.sort_order, o.id, o.sort_order
           ORDER BY q.sort_order ASC, o.sort_order ASC`,
        )
        .bind(roomId),
      database
        .prepare(
          `SELECT q.id AS questionId, COUNT(v.id) AS voterCount
           FROM questions q
           LEFT JOIN votes v ON v.question_id = q.id
           WHERE q.room_id = ? AND q.status IN ('active', 'closed')
           GROUP BY q.id, q.sort_order
           ORDER BY q.sort_order ASC`,
        )
        .bind(roomId),
    ]);

  const room = roomResult.results[0] as RoomRow | undefined;

  if (!room) {
    return null;
  }

  const optionsByQuestion = new Map<string, SnapshotQuestion["options"]>();

  for (const option of optionResult.results as unknown as OptionRow[]) {
    const questionOptions = optionsByQuestion.get(option.questionId) ?? [];
    questionOptions.push({
      id: option.id,
      label: option.label,
      sortOrder: option.sortOrder,
    });
    optionsByQuestion.set(option.questionId, questionOptions);
  }

  const questions: SnapshotQuestion[] = (questionResult.results as unknown as QuestionRow[]).map(
    (question) => ({
      ...question,
      options: optionsByQuestion.get(question.id) ?? [],
    }),
  );
  const voterCounts = new Map(
    (voterCountResult.results as unknown as VoterCountRow[]).map((row) => [
      row.questionId,
      row.voterCount,
    ]),
  );
  const resultsByQuestion: Record<string, QuestionResults> = {};

  for (const question of questions) {
    if (question.status === "draft") {
      continue;
    }

    resultsByQuestion[question.id] = {
      questionId: question.id,
      voterCount: voterCounts.get(question.id) ?? 0,
      counts: {},
    };
  }

  for (const count of countResult.results as unknown as CountRow[]) {
    const questionResults = resultsByQuestion[count.questionId];

    if (questionResults) {
      questionResults.counts[count.optionId] = count.voteCount;
    }
  }

  const snapshot: RoomSnapshot = {
    roomId: room.id,
    roomStatus: room.status,
    stateVersion: room.stateVersion,
    questions,
    resultsByQuestion,
  };

  return { title: room.title, snapshot };
}

export async function notifyRoomSnapshot(env: Env, snapshot: RoomSnapshot): Promise<void> {
  const roomEvents = env.ROOM_EVENTS.getByName(snapshot.roomId);

  try {
    const response = await roomEvents.fetch("https://room-events/snapshot", {
      body: JSON.stringify(snapshot),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      console.error("Failed to update room snapshot", {
        roomId: snapshot.roomId,
        stateVersion: snapshot.stateVersion,
        status: response.status,
      });
    }
  } catch (error) {
    console.error("Failed to update room snapshot", {
      error,
      roomId: snapshot.roomId,
      stateVersion: snapshot.stateVersion,
    });
  }
}
