import { type FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { participantRoomResponseSchema } from "../../shared/api";
import {
  roomSnapshotSchema,
  type QuestionResults,
  type RoomSnapshot,
  type SnapshotQuestion,
} from "../../shared/room-snapshot";
import { ApiRequestError, requestJson } from "../api";
import { SiteHeader } from "../components/site-header";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function RoomPage() {
  const { roomId = "" } = useParams();
  const [roomTitle, setRoomTitle] = useState("投票ルーム");
  const [snapshot, setSnapshot] = useState<RoomSnapshot>();
  const [votedQuestionIds, setVotedQuestionIds] = useState<string[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [isLoading, setIsLoading] = useState(true);
  const [submittingQuestionId, setSubmittingQuestionId] = useState<string>();
  const [error, setError] = useState("");
  const votedQuestionIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    let eventSource: EventSource | undefined;

    const refreshRoom = async () => {
      try {
        const response = await requestJson<unknown>(`/api/rooms/${roomId}`);
        const parsed = participantRoomResponseSchema.parse(response);

        if (isCancelled) {
          return;
        }

        setRoomTitle(parsed.title);
        setVotedQuestionIds(parsed.votedQuestionIds);
        votedQuestionIdsRef.current = parsed.votedQuestionIds;
        setSnapshot(parsed.snapshot);
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "ルーム情報を取得できませんでした。",
          );
          setConnectionStatus("disconnected");
        }
      }
    };

    const connect = async () => {
      try {
        await refreshRoom();

        eventSource = new EventSource(`/api/rooms/${roomId}/events`);
        eventSource.onopen = () => setConnectionStatus("connected");
        eventSource.onerror = () => setConnectionStatus("disconnected");
        eventSource.addEventListener("room.snapshot", (event) => {
          const message = event as MessageEvent<string>;

          try {
            const snapshotResult = roomSnapshotSchema.safeParse(JSON.parse(message.data));

            if (snapshotResult.success) {
              if (votedQuestionIdsRef.current.length > 0) {
                void refreshRoom();
              } else {
                setSnapshot(snapshotResult.data);
              }
            }
          } catch {
            setConnectionStatus("disconnected");
          }
        });
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void connect();

    return () => {
      isCancelled = true;
      eventSource?.close();
    };
  }, [roomId]);

  const toggleOption = (question: SnapshotQuestion, optionId: string) => {
    setSelectedOptionIds((current) => {
      const selectedIds = current[question.id] ?? [];

      if (question.questionType === "single") {
        return { ...current, [question.id]: [optionId] };
      }

      return {
        ...current,
        [question.id]: selectedIds.includes(optionId)
          ? selectedIds.filter((currentId) => currentId !== optionId)
          : [...selectedIds, optionId],
      };
    });
  };

  const submitVote = async (event: FormEvent<HTMLFormElement>, question: SnapshotQuestion) => {
    event.preventDefault();
    const questionOptionIds = selectedOptionIds[question.id] ?? [];

    if (
      questionOptionIds.length < question.minChoices ||
      questionOptionIds.length > question.maxChoices
    ) {
      setError(
        question.questionType === "single"
          ? "選択肢を1つ選んでください。"
          : `${question.minChoices}〜${question.maxChoices}件を選んでください。`,
      );
      return;
    }

    setError("");
    setSubmittingQuestionId(question.id);

    try {
      const response = await requestJson<{
        snapshot: unknown;
        votedQuestionIds: string[];
      }>(`/api/rooms/${roomId}/questions/${question.id}/votes`, {
        body: JSON.stringify({ optionIds: questionOptionIds }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const votedSnapshot = roomSnapshotSchema.parse(response.snapshot);

      setVotedQuestionIds(response.votedQuestionIds);
      votedQuestionIdsRef.current = response.votedQuestionIds;
      setSnapshot(votedSnapshot);
    } catch (submissionError) {
      if (submissionError instanceof ApiRequestError && submissionError.code === "already_voted") {
        try {
          const response = await requestJson<unknown>(`/api/rooms/${roomId}`);
          const parsed = participantRoomResponseSchema.parse(response);
          setVotedQuestionIds(parsed.votedQuestionIds);
          votedQuestionIdsRef.current = parsed.votedQuestionIds;
          setSnapshot(parsed.snapshot);
        } catch {
          setError("投票結果を取得できませんでした。");
        }
      } else {
        setError(
          submissionError instanceof Error ? submissionError.message : "投票できませんでした。",
        );
      }
    } finally {
      setSubmittingQuestionId(undefined);
    }
  };

  const activeQuestions =
    snapshot?.questions.filter((question) => question.status === "active") ?? [];
  const unansweredActiveQuestions = activeQuestions.filter(
    (question) => !votedQuestionIds.includes(question.id),
  );
  const hasAnsweredActiveQuestion = activeQuestions.some((question) =>
    votedQuestionIds.includes(question.id),
  );
  const connectionLabel = {
    connected: "接続中",
    connecting: "接続準備中",
    disconnected: "再接続中",
  }[connectionStatus];

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader showCreateLink={false} />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-6 py-7 text-white sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <span className="size-2 rounded-full bg-emerald-400" />
                {connectionLabel}
              </span>
              <span className="text-xs font-semibold tracking-[0.12em] text-slate-400">
                PARTICIPANT VIEW
              </span>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{roomTitle}</h1>
            <p className="mt-2 font-mono text-xs text-slate-400">Room ID: {roomId}</p>
          </div>

          {isLoading ? (
            <MessagePanel eyebrow="LOADING" icon="…" message="ルーム情報を読み込んでいます" />
          ) : snapshot?.roomStatus === "closed" ? (
            <MessagePanel eyebrow="CLOSED" icon="✓" message="この投票ルームは終了しました" />
          ) : activeQuestions.length > 0 ? (
            <div className="space-y-6 bg-slate-50/70 px-5 py-6 sm:p-8">
              {hasAnsweredActiveQuestion ? (
                <p
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800"
                  role="status"
                >
                  投票を受け付けました。結果は質問一覧で確認できます。
                </p>
              ) : null}
              {unansweredActiveQuestions.map((question) => (
                <VoteForm
                  isSubmitting={submittingQuestionId === question.id}
                  key={question.id}
                  onSubmit={(event) => submitVote(event, question)}
                  onToggle={(optionId) => toggleOption(question, optionId)}
                  question={question}
                  selectedOptionIds={selectedOptionIds[question.id] ?? []}
                />
              ))}
            </div>
          ) : (
            <MessagePanel eyebrow="WAITING" icon="…" message="現在受付中の質問はありません" />
          )}
        </section>

        {snapshot && snapshot.questions.length > 0 ? (
          <QuestionOverview
            questions={snapshot.questions}
            resultsByQuestion={snapshot.resultsByQuestion}
            votedQuestionIds={votedQuestionIds}
          />
        ) : null}

        {error ? (
          <p
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : (
          <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <h2 className="text-sm font-bold text-sky-950">この画面はそのままで大丈夫です</h2>
            <p className="mt-2 text-sm leading-6 text-sky-800">
              質問の開始・終了や集計結果はリアルタイムで更新されます。
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function VoteForm({
  isSubmitting,
  onSubmit,
  onToggle,
  question,
  selectedOptionIds,
}: {
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggle: (optionId: string) => void;
  question: SnapshotQuestion;
  selectedOptionIds: string[];
}) {
  return (
    <form
      aria-label={`${question.title}に回答`}
      className="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm sm:px-8"
      onSubmit={onSubmit}
    >
      <p className="text-xs font-bold tracking-[0.14em] text-sky-700">NOW VOTING</p>
      <h2 className="mt-3 text-2xl font-bold leading-9 tracking-tight text-slate-950">
        {question.title}
      </h2>
      <p className="mt-3 text-sm text-slate-500">
        {question.questionType === "single"
          ? "選択肢を1つ選んでください。"
          : `選択肢を${question.minChoices}〜${question.maxChoices}件選んでください。`}
      </p>

      <fieldset className="mt-7 space-y-3" disabled={isSubmitting}>
        <legend className="sr-only">選択肢</legend>
        {question.options.map((option) => {
          const isChecked = selectedOptionIds.includes(option.id);
          const reachedLimit =
            question.questionType === "multiple" &&
            !isChecked &&
            selectedOptionIds.length >= question.maxChoices;

          return (
            <label
              className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
                isChecked
                  ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                  : "border-slate-200 hover:border-sky-300"
              }`}
              key={option.id}
            >
              <input
                checked={isChecked}
                className="size-5 accent-sky-600"
                disabled={reachedLimit}
                name={`question-${question.id}`}
                onChange={() => onToggle(option.id)}
                type={question.questionType === "single" ? "radio" : "checkbox"}
                value={option.id}
              />
              <span className="font-bold text-slate-800">{option.label}</span>
            </label>
          );
        })}
      </fieldset>

      <button
        className="mt-7 w-full rounded-xl bg-sky-600 px-6 py-3.5 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting || selectedOptionIds.length === 0}
        type="submit"
      >
        {isSubmitting ? "送信中..." : "投票する"}
      </button>
    </form>
  );
}

function QuestionOverview({
  questions,
  resultsByQuestion,
  votedQuestionIds,
}: {
  questions: SnapshotQuestion[];
  resultsByQuestion: Record<string, QuestionResults>;
  votedQuestionIds: string[];
}) {
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-sky-700">QUESTION LIST</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">質問一覧</h2>
        </div>
        <p className="text-sm font-bold text-slate-500">{questions.length}件</p>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((question, index) => {
          const hasVoted = votedQuestionIds.includes(question.id);
          const results = resultsByQuestion[question.id];
          const status = {
            active: {
              label: "回答受付中",
              className: "bg-emerald-50 text-emerald-700",
            },
            closed: {
              label: "終了",
              className: "bg-slate-100 text-slate-600",
            },
            draft: {
              label: "開始前",
              className: "bg-amber-50 text-amber-700",
            },
          }[question.status];

          return (
            <article
              aria-label={`質問${index + 1}: ${question.title}`}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                question.status === "active"
                  ? "border-emerald-200 ring-2 ring-emerald-50"
                  : "border-slate-200"
              }`}
              key={question.id}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {question.questionType === "single" ? "単一選択" : "複数選択"}
                    </span>
                  </div>
                  <p className="mt-3 font-bold leading-7 text-slate-950">{question.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {question.status === "active"
                      ? hasVoted
                        ? "回答済みです。結果はリアルタイムで更新されます。"
                        : "上の投票欄から回答できます。"
                      : question.status === "draft"
                        ? "主催者が開始するまで回答できません。"
                        : hasVoted
                          ? "受付は終了しました。最終結果です。"
                          : "この質問の受付は終了しています。"}
                  </p>
                </div>
              </div>

              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => {
                  const voteCount = results?.counts[option.id] ?? 0;
                  const percentage =
                    results && results.voterCount > 0
                      ? Math.round((voteCount / results.voterCount) * 100)
                      : 0;

                  return (
                    <li
                      aria-disabled="true"
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                      key={option.id}
                    >
                      <span className="min-w-0">
                        <span className="mr-2 font-bold text-slate-400">{optionIndex + 1}.</span>
                        <span>{option.label}</span>
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
        })}
      </div>
    </section>
  );
}

function MessagePanel({
  eyebrow,
  icon,
  message,
}: {
  eyebrow: string;
  icon: string;
  message: string;
}) {
  return (
    <div className="px-6 py-14 text-center sm:px-8 sm:py-18">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-sky-50 text-2xl font-bold text-sky-600">
        {icon}
      </span>
      <p className="mt-6 text-xs font-bold tracking-[0.14em] text-sky-700">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{message}</h2>
    </div>
  );
}
