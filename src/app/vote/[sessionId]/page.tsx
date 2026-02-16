"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Choice, GetSessionResponse, SubmitVoteRequest, SubmitVoteResponse } from "@/lib/types";
import { OrganizerView } from "./components/organizer-view";
import { VoterView } from "./components/voter-view";

export default function VoteSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const isOrganizer = searchParams.get("view") === "organizer";

  const [session, setSession] = useState<GetSessionResponse | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  // セッション情報を取得
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/vote/${sessionId}`);
        const data: GetSessionResponse = await res.json();

        if (!res.ok) {
          setError(data.message || "セッションを読み込めませんでした");
          return;
        }

        setSession(data);
        setChoices(data.choices as Choice[]);
        if (data.message) {
          setMessage(data.message);
        }
      } catch {
        setError("セッションを読み込めませんでした");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  // リアルタイム更新用のSSE
  useEffect(() => {
    // 主催者、または参加者が結果表示を選んだ場合のみ接続
    if (!isOrganizer && !showResults) return;

    const eventSource = new EventSource(`/api/vote/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.event === "init" || payload.event === "update") {
          setChoices(payload.data.choices || []);
        }

        if (payload.event === "closed") {
          setMessage(payload.data.message);
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: "closed",
                  canVote: false,
                }
              : null,
          );
        }
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, isOrganizer, showResults]);

  // 投票送信を処理
  const handleSubmit = async (selectedChoices: string[]) => {
    if (selectedChoices.length === 0) {
      setError("選択肢を選んでください");
      return;
    }

    try {
      const body: SubmitVoteRequest = {
        choiceIds: selectedChoices,
      };
      const res = await fetch(`/api/vote/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as SubmitVoteResponse & {
        error?: string;
      };

      if (!res.ok) {
        setError(data.error || "投票に失敗しました");
        return;
      }

      setMessage(data.message);
      // 投票済み状態を反映
      setSession((prev) => (prev ? { ...prev, canVote: false } : null));
    } catch {
      setError("投票に失敗しました");
    }
  };

  // セッションを終了
  const handleCloseSession = async () => {
    try {
      await fetch(`/api/vote/${sessionId}/close`, {
        method: "POST",
      });
      setMessage("投票を終了しました");
    } catch {
      setError("投票の終了に失敗しました");
    }
  };

  // データをエクスポート
  const handleExport = async (format: "json" | "csv") => {
    try {
      const res = await fetch(`/api/vote/${sessionId}/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vote-results-${sessionId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("エクスポートに失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">読み込み中...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-red-600">{error || "エラーが発生しました"}</p>
      </div>
    );
  }

  // 主催者ビュー
  if (isOrganizer) {
    return (
      <OrganizerView
        session={session}
        choices={choices}
        sessionId={sessionId}
        onCloseSession={handleCloseSession}
        onExport={handleExport}
      />
    );
  }

  // 参加者ビュー
  return (
    <VoterView
      session={session}
      choices={choices}
      message={message}
      error={error}
      showResults={showResults}
      setShowResults={setShowResults}
      onSubmit={handleSubmit}
    />
  );
}
