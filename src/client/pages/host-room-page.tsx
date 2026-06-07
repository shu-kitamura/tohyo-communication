import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { hostRoomResponseSchema, type RoomQuestion } from "../../shared/api";
import {
  roomSnapshotSchema,
  type QuestionResults,
  type RoomSnapshot,
} from "../../shared/room-snapshot";
import { requestJson } from "../api";
import { QuestionDialog } from "../components/question-dialog";
import { SiteHeader } from "../components/site-header";
import type { QuestionDraft, RoomCreationNavigationState } from "../types/room";

export function HostRoomPage() {
  const { roomId = "" } = useParams();
  const location = useLocation();
  const creationState = location.state as RoomCreationNavigationState | null;
  const [roomTitle, setRoomTitle] = useState(creationState?.roomTitle ?? "投票ルーム");
  const [questions, setQuestions] = useState<RoomQuestion[]>([]);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [startingQuestionId, setStartingQuestionId] = useState<string>();
  const [closingQuestionId, setClosingQuestionId] = useState<string>();
  const [snapshot, setSnapshot] = useState<RoomSnapshot>();

  const participantUrl = `${window.location.origin}/rooms/${roomId}`;
  const activeQuestionCount = questions.filter((question) => question.status === "active").length;
  const responseCount = questions
    .filter((question) => question.status === "active")
    .reduce(
      (total, question) => total + (snapshot?.resultsByQuestion[question.id]?.voterCount ?? 0),
      0,
    );

  const applySnapshot = (nextSnapshot: RoomSnapshot) => {
    setSnapshot(nextSnapshot);
    setQuestions(nextSnapshot.questions);
  };

  useEffect(() => {
    let isCancelled = false;
    const eventSource = new EventSource(`/api/rooms/${roomId}/events`);

    const loadRoom = async () => {
      try {
        const response = await requestJson<unknown>(`/api/rooms/${roomId}/host`);
        const parsed = hostRoomResponseSchema.parse(response);

        if (!isCancelled) {
          setRoomTitle(parsed.room.title);
          setQuestions(parsed.questions);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "ルーム情報を取得できませんでした。",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadRoom();
    eventSource.addEventListener("room.snapshot", (event) => {
      const message = event as MessageEvent<string>;

      try {
        const result = roomSnapshotSchema.safeParse(JSON.parse(message.data));

        if (result.success && !isCancelled) {
          applySnapshot(result.data);
        }
      } catch {
        setError("リアルタイム更新を受信できませんでした。");
      }
    });

    return () => {
      isCancelled = true;
      eventSource.close();
    };
  }, [roomId]);

  const addQuestion = async (question: QuestionDraft) => {
    const response = await requestJson<{ question?: RoomQuestion }>(
      `/api/rooms/${roomId}/questions`,
      {
        body: JSON.stringify(question),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    if (!response.question) {
      throw new Error("追加した質問を取得できませんでした。");
    }

    setQuestions((current) =>
      current.some((question) => question.id === response.question?.id)
        ? current
        : [...current, response.question as RoomQuestion],
    );
    setIsQuestionDialogOpen(false);
    setError("");
  };

  const startQuestion = async (questionId: string) => {
    setStartingQuestionId(questionId);
    setError("");

    try {
      const response = await requestJson<{ snapshot: unknown }>(
        `/api/rooms/${roomId}/questions/${questionId}/start`,
        {
          method: "POST",
        },
      );
      applySnapshot(roomSnapshotSchema.parse(response.snapshot));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "投票を開始できませんでした。");
    } finally {
      setStartingQuestionId(undefined);
    }
  };

  const closeQuestion = async (questionId: string) => {
    if (!window.confirm("この投票を終了しますか？終了後は新しい回答を受け付けません。")) {
      return;
    }

    setClosingQuestionId(questionId);
    setError("");

    try {
      const response = await requestJson<{ snapshot: unknown }>(
        `/api/rooms/${roomId}/questions/${questionId}/close`,
        {
          method: "POST",
        },
      );
      applySnapshot(roomSnapshotSchema.parse(response.snapshot));
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "投票を終了できませんでした。");
    } finally {
      setClosingQuestionId(undefined);
    }
  };

  const copyParticipantUrl = async () => {
    try {
      await navigator.clipboard.writeText(participantUrl);
      setCopyStatus("参加者URLをコピーしました。");
    } catch {
      setCopyStatus("コピーできませんでした。URLを選択してコピーしてください。");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader showCreateLink={false} />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl shadow-slate-200">
          <div className="grid gap-8 px-6 py-8 sm:px-9 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  {activeQuestionCount > 0 ? `${activeQuestionCount}件受付中` : "待機中"}
                </span>
                <span className="text-xs font-semibold tracking-[0.12em] text-slate-400">
                  HOST VIEW
                </span>
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{roomTitle}</h1>
              <p className="mt-3 font-mono text-sm text-slate-400">Room ID: {roomId}</p>
            </div>

            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 font-bold text-white transition hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              onClick={() => setIsQuestionDialogOpen(true)}
              type="button"
            >
              <span aria-hidden="true">＋</span>
              質問を追加
            </button>
          </div>

          <div className="grid border-t border-slate-800 sm:grid-cols-3">
            <RoomMetric label="質問" value={`${questions.length}件`} />
            <RoomMetric label="投票中" value={`${activeQuestionCount}件`} />
            <RoomMetric label="回答" value={`${responseCount}件`} />
          </div>
        </section>

        {error ? (
          <p
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-sky-700">QUESTIONS</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">質問一覧</h2>
              </div>
              {questions.length > 0 ? (
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-sky-400 hover:text-sky-700"
                  onClick={() => setIsQuestionDialogOpen(true)}
                  type="button"
                >
                  ＋ 追加
                </button>
              ) : null}
            </div>

            {isLoading ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-500">
                ルーム情報を読み込んでいます...
              </div>
            ) : questions.length === 0 ? (
              <EmptyQuestions onAdd={() => setIsQuestionDialogOpen(true)} />
            ) : (
              <div className="mt-6 space-y-4">
                {questions.map((question, index) => (
                  <QuestionCard
                    index={index}
                    isClosing={closingQuestionId === question.id}
                    isStarting={startingQuestionId === question.id}
                    key={question.id}
                    onClose={() => closeQuestion(question.id)}
                    onStart={() => startQuestion(question.id)}
                    question={question}
                    results={snapshot?.resultsByQuestion[question.id]}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold tracking-[0.14em] text-sky-700">SHARE</p>
              <h2 className="mt-3 font-bold text-slate-950">参加者に共有</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">このURLを参加者へ案内します。</p>
              <label
                className="mt-5 block text-xs font-bold text-slate-500"
                htmlFor="participant-url"
              >
                参加者URL
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 outline-none focus:border-sky-500"
                id="participant-url"
                readOnly
                value={participantUrl}
              />
              <button
                className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
                onClick={copyParticipantUrl}
                type="button"
              >
                URLをコピー
              </button>
              {copyStatus ? (
                <p className="mt-3 text-xs leading-5 text-slate-500" role="status">
                  {copyStatus}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
              <h2 className="text-sm font-bold text-sky-950">D1へ自動保存されます</h2>
              <p className="mt-2 text-xs leading-5 text-sky-800">
                質問の追加、投票開始・終了は保存され、参加者画面へリアルタイム配信されます。
              </p>
            </section>
          </aside>
        </div>
      </main>

      <QuestionDialog
        isOpen={isQuestionDialogOpen}
        onAdd={addQuestion}
        onClose={() => setIsQuestionDialogOpen(false)}
      />
    </div>
  );
}

function RoomMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-slate-800 px-6 py-5 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function EmptyQuestions({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-600">
        ?
      </span>
      <h3 className="mt-5 text-lg font-bold text-slate-950">質問がまだありません</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        質問と選択肢を追加すると、参加者へ投票を案内できるようになります。
      </p>
      <button
        className="mt-6 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
        onClick={onAdd}
        type="button"
      >
        最初の質問を追加
      </button>
    </div>
  );
}

function QuestionCard({
  index,
  isClosing,
  isStarting,
  onClose,
  onStart,
  question,
  results,
}: {
  index: number;
  isClosing: boolean;
  isStarting: boolean;
  onClose: () => void;
  onStart: () => void;
  question: RoomQuestion;
  results?: QuestionResults;
}) {
  const statusLabel = {
    active: "投票受付中",
    closed: "終了",
    draft: "下書き",
  }[question.status];

  return (
    <article
      aria-label={`質問: ${question.title}`}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  question.status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {statusLabel}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {question.questionType === "single" ? "単一選択" : "複数選択"}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-bold leading-7 text-slate-950">{question.title}</h3>
          </div>
        </div>
        {question.status === "draft" ? (
          <button
            className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStarting}
            onClick={onStart}
            type="button"
          >
            {isStarting ? "開始中..." : "投票を開始"}
          </button>
        ) : question.status === "active" ? (
          <button
            className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isClosing}
            onClick={onClose}
            type="button"
          >
            {isClosing ? "終了中..." : "投票を終了"}
          </button>
        ) : (
          <span className="shrink-0 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">
            終了
          </span>
        )}
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, optionIndex) => {
          const voteCount = results?.counts[option.id] ?? 0;
          const percentage =
            results && results.voterCount > 0
              ? Math.round((voteCount / results.voterCount) * 100)
              : 0;

          return (
            <li
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
              key={option.id}
            >
              <span className="min-w-0">
                <span className="mr-2 font-bold text-slate-400">{optionIndex + 1}.</span>
                {option.label}
              </span>
              {results ? (
                <span
                  aria-label={`${option.label}: ${voteCount}票、${percentage}%`}
                  className="shrink-0 font-bold text-slate-800"
                >
                  {voteCount}票 <span className="text-slate-400">({percentage}%)</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
