import { type FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { hostSessionResponseSchema, participantRoomResponseSchema } from "../../shared/api";
import {
  roomSnapshotSchema,
  type QuestionResults,
  type RoomSnapshot,
  type SnapshotQuestion,
} from "../../shared/room-snapshot";
import { ApiRequestError, requestJson } from "../api";
import { SiteHeader } from "../components/site-header";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface RoomPageProps {
  onHostAuthenticated?: () => void;
}

export function RoomPage({ onHostAuthenticated }: RoomPageProps = {}) {
  const { roomId = "" } = useParams();
  const [roomTitle, setRoomTitle] = useState("投票ルーム");
  const [snapshot, setSnapshot] = useState<RoomSnapshot>();
  const [votedQuestionIds, setVotedQuestionIds] = useState<string[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [isLoading, setIsLoading] = useState(true);
  const [submittingQuestionId, setSubmittingQuestionId] = useState<string>();
  const [hostPassword, setHostPassword] = useState("");
  const [hostAuthError, setHostAuthError] = useState("");
  const [isHostAuthenticating, setIsHostAuthenticating] = useState(false);
  const [isHostAccessOpen, setIsHostAccessOpen] = useState(false);
  const [error, setError] = useState("");
  const eventSourceRef = useRef<EventSource | undefined>(undefined);
  const reconnectEventSourceRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let isCancelled = false;

    const refreshRoom = async () => {
      try {
        const response = await requestJson<unknown>(`/api/rooms/${roomId}`);
        const parsed = participantRoomResponseSchema.parse(response);

        if (isCancelled) {
          return;
        }

        setRoomTitle(parsed.title);
        setVotedQuestionIds(parsed.votedQuestionIds);
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

    const connectEventSource = () => {
      const previousEventSource = eventSourceRef.current;
      const eventSource = new EventSource(`/api/rooms/${roomId}/events`);
      eventSourceRef.current = eventSource;
      previousEventSource?.close();
      setConnectionStatus("connecting");

      eventSource.onopen = () => {
        if (eventSourceRef.current === eventSource) {
          setConnectionStatus("connected");
        }
      };
      eventSource.onerror = () => {
        if (eventSourceRef.current === eventSource) {
          setConnectionStatus("disconnected");
        }
      };
      eventSource.addEventListener("room.snapshot", (event) => {
        if (eventSourceRef.current !== eventSource) {
          return;
        }

        const message = event as MessageEvent<string>;

        try {
          const snapshotResult = roomSnapshotSchema.safeParse(JSON.parse(message.data));

          if (snapshotResult.success) {
            setSnapshot(snapshotResult.data);
          }
        } catch {
          setConnectionStatus("disconnected");
        }
      });
    };

    reconnectEventSourceRef.current = connectEventSource;

    const connect = async () => {
      try {
        await refreshRoom();

        if (!isCancelled) {
          connectEventSource();
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void connect();

    return () => {
      isCancelled = true;
      reconnectEventSourceRef.current = () => undefined;
      eventSourceRef.current?.close();
      eventSourceRef.current = undefined;
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

      reconnectEventSourceRef.current();
      setVotedQuestionIds(response.votedQuestionIds);
      setSnapshot(votedSnapshot);
    } catch (submissionError) {
      if (submissionError instanceof ApiRequestError && submissionError.code === "already_voted") {
        try {
          const response = await requestJson<unknown>(`/api/rooms/${roomId}`);
          const parsed = participantRoomResponseSchema.parse(response);
          setVotedQuestionIds(parsed.votedQuestionIds);
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

  const authenticateHost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hostPassword) {
      setHostAuthError("管理パスワードを入力してください。");
      return;
    }

    setHostAuthError("");
    setIsHostAuthenticating(true);

    try {
      const response = await requestJson<unknown>(`/api/rooms/${roomId}/host-session`, {
        body: JSON.stringify({ adminPassword: hostPassword }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      hostSessionResponseSchema.parse(response);
      setHostPassword("");

      if (onHostAuthenticated) {
        onHostAuthenticated();
      } else {
        window.location.reload();
      }
    } catch (authError) {
      setHostAuthError(
        authError instanceof Error ? authError.message : "ホスト認証に失敗しました。",
      );
    } finally {
      setIsHostAuthenticating(false);
    }
  };

  const hasAnsweredActiveQuestion =
    snapshot?.questions.some(
      (question) => question.status === "active" && votedQuestionIds.includes(question.id),
    ) ?? false;
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
                GUEST VIEW
              </span>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{roomTitle}</h1>
            <p className="mt-2 font-mono text-xs text-slate-400">Room ID: {roomId}</p>
          </div>

          {isLoading ? (
            <MessagePanel eyebrow="LOADING" icon="…" message="ルーム情報を読み込んでいます" />
          ) : snapshot?.roomStatus === "closed" ? (
            <MessagePanel eyebrow="CLOSED" icon="✓" message="この投票ルームは終了しました" />
          ) : !snapshot || snapshot.questions.length === 0 ? (
            <MessagePanel eyebrow="WAITING" icon="…" message="現在表示できる投票はありません" />
          ) : (
            <div className="bg-slate-50/70 px-6 py-5 text-sm font-medium text-slate-600 sm:px-8">
              下の投票一覧から回答できます。
            </div>
          )}
        </section>

        {hasAnsweredActiveQuestion ? (
          <p
            className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800"
            role="status"
          >
            投票を受け付けました。結果は投票一覧で確認できます。
          </p>
        ) : null}

        {snapshot && snapshot.questions.length > 0 ? (
          <QuestionOverview
            onSubmit={submitVote}
            onToggle={toggleOption}
            questions={snapshot.questions}
            resultsByQuestion={snapshot.resultsByQuestion}
            selectedOptionIds={selectedOptionIds}
            submittingQuestionId={submittingQuestionId}
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
              投票の開始・終了や集計結果はリアルタイムで更新されます。
            </p>
          </section>
        )}

        <HostAccessPanel
          adminPassword={hostPassword}
          error={hostAuthError}
          isOpen={isHostAccessOpen}
          isSubmitting={isHostAuthenticating}
          onChange={setHostPassword}
          onOpen={() => setIsHostAccessOpen(true)}
          onSubmit={authenticateHost}
        />
      </main>
    </div>
  );
}

function HostAccessPanel({
  adminPassword,
  error,
  isOpen,
  isSubmitting,
  onChange,
  onOpen,
  onSubmit,
}: {
  adminPassword: string;
  error: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onOpen: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-end gap-3">
      {!isOpen ? (
        <button
          className="text-sm font-bold text-slate-500 underline-offset-4 transition hover:text-sky-700 hover:underline"
          onClick={onOpen}
          type="button"
        >
          ホストとして開く
        </button>
      ) : (
        <form className="grid w-full gap-2 sm:max-w-md sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="host-admin-password">
            管理パスワード
          </label>
          <input
            autoComplete="current-password"
            autoFocus
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            id="host-admin-password"
            onChange={(event) => onChange(event.target.value)}
            placeholder="管理パスワード"
            type="password"
            value={adminPassword}
          />
          <button
            className="min-h-10 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "確認中..." : "開く"}
          </button>
        </form>
      )}

      {error ? (
        <p
          className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:max-w-md"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function QuestionOverview({
  onSubmit,
  onToggle,
  questions,
  resultsByQuestion,
  selectedOptionIds,
  submittingQuestionId,
  votedQuestionIds,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>, question: SnapshotQuestion) => void;
  onToggle: (question: SnapshotQuestion, optionId: string) => void;
  questions: SnapshotQuestion[];
  resultsByQuestion: Record<string, QuestionResults>;
  selectedOptionIds: Record<string, string[]>;
  submittingQuestionId?: string;
  votedQuestionIds: string[];
}) {
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-sky-700">POLL LIST</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">投票一覧</h2>
        </div>
        <p className="text-sm font-bold text-slate-500">{questions.length}件</p>
      </div>

      <div className="mt-4 space-y-5">
        {questions.map((question, index) => {
          const hasVoted = votedQuestionIds.includes(question.id);
          const results = resultsByQuestion[question.id];
          const isAnswerable = question.status === "active" && !hasVoted;
          const isSubmitting = submittingQuestionId === question.id;
          const questionOptionIds = selectedOptionIds[question.id] ?? [];
          const status = {
            active: {
              eyebrow: "LIVE POLL",
              label: hasVoted ? "回答済み" : "投票中",
              summary: results ? `ゲスト ${results.voterCount}人` : "受付中",
              className: "bg-emerald-50 text-emerald-700",
              dotClassName: "bg-emerald-500",
            },
            closed: {
              eyebrow: "POLL RESULT",
              label: "終了",
              summary: results ? `ゲスト ${results.voterCount}人` : "終了済み",
              className: "bg-slate-100 text-slate-600",
              dotClassName: "bg-slate-400",
            },
            draft: {
              eyebrow: "DRAFT POLL",
              label: "開始前",
              summary: "待機中",
              className: "bg-amber-50 text-amber-700",
              dotClassName: "bg-amber-500",
            },
          }[question.status];
          const description =
            question.status === "active"
              ? hasVoted
                ? "回答済みです。結果はリアルタイムで更新されます。"
                : question.questionType === "single"
                  ? "選択肢を1つ選んで回答してください。"
                  : `${question.minChoices}〜${question.maxChoices}件を選んで回答してください。`
              : question.status === "draft"
                ? "ホストが開始するまで回答できません。"
                : hasVoted
                  ? "受付は終了しました。最終結果です。"
                  : "この投票の受付は終了しています。";

          const cardBody = (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-bold tracking-[0.14em] text-slate-400">
                    {status.eyebrow}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{status.summary}</p>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${status.className}`}
                >
                  <span className={`size-2 rounded-full ${status.dotClassName}`} />
                  {status.label}
                </span>
              </div>

              <div className="px-6 py-7">
                <p className="text-xs font-bold tracking-[0.14em] text-sky-700">
                  QUESTION {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-lg font-bold leading-7 text-slate-950">
                  {question.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-semibold text-slate-400">
                    {question.questionType === "single" ? "単一選択" : "複数選択"}
                  </span>
                  <span className="text-slate-500">{description}</span>
                </div>

                <ol className="mt-7 space-y-5">
                  {question.options.map((option) => {
                    const isChecked = questionOptionIds.includes(option.id);
                    const reachedLimit =
                      question.questionType === "multiple" &&
                      !isChecked &&
                      questionOptionIds.length >= question.maxChoices;
                    const voteCount = results?.counts[option.id] ?? 0;
                    const percentage =
                      results && results.voterCount > 0
                        ? Math.round((voteCount / results.voterCount) * 100)
                        : 0;

                    if (isAnswerable) {
                      return (
                        <li
                          className={`rounded-2xl border text-sm transition ${
                            isChecked
                              ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                              : "border-slate-200 bg-white hover:border-sky-300"
                          }`}
                          key={option.id}
                        >
                          <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                            <input
                              checked={isChecked}
                              className="size-4 shrink-0 accent-sky-600"
                              disabled={isSubmitting || reachedLimit}
                              name={`question-${question.id}`}
                              onChange={() => onToggle(question, option.id)}
                              type={question.questionType === "single" ? "radio" : "checkbox"}
                              value={option.id}
                            />
                            <span className="truncate font-semibold text-slate-800">
                              {option.label}
                            </span>
                          </label>
                        </li>
                      );
                    }

                    return (
                      <li key={option.id}>
                        <div className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-800">
                          <span className="min-w-0 truncate">{option.label}</span>
                          {results ? (
                            <span
                              aria-label={`${option.label}: ${voteCount}票、${percentage}%`}
                              className="shrink-0 tabular-nums"
                            >
                              {voteCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width] duration-500"
                            style={{ width: results ? `${Math.min(percentage, 100)}%` : "0%" }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {isAnswerable ? (
                  <button
                    className="mt-7 w-full rounded-xl bg-sky-600 px-6 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSubmitting || questionOptionIds.length === 0}
                    type="submit"
                  >
                    {isSubmitting ? "送信中..." : "投票する"}
                  </button>
                ) : null}
              </div>
            </>
          );

          return (
            <article
              aria-label={`質問${index + 1}: ${question.title}`}
              className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
                question.status === "active"
                  ? "border-emerald-200 ring-2 ring-emerald-50"
                  : "border-slate-200"
              }`}
              key={question.id}
            >
              {isAnswerable ? (
                <form
                  aria-label={`${question.title}に回答`}
                  onSubmit={(event) => onSubmit(event, question)}
                >
                  {cardBody}
                </form>
              ) : (
                cardBody
              )}
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
