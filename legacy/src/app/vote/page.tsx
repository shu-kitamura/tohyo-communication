"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreateSessionRequest,
  CreateSessionResponse,
  MAX_SESSION_CHOICES,
  MIN_SESSION_CHOICES,
  VoteType,
} from "@/lib/types";

import { AlertCircleIcon, Plus, X } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function CreateVotePage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [voteType, setVoteType] = useState<VoteType>("single");
  const [choices, setChoices] = useState<string[]>(
    Array.from({ length: MIN_SESSION_CHOICES }, () => ""),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddChoice = () => {
    if (choices.length < MAX_SESSION_CHOICES) {
      setChoices([...choices, ""]);
    }
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length > MIN_SESSION_CHOICES) {
      setChoices(choices.filter((_, i) => i !== index));
    }
  };

  const handleChoiceChange = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!question.trim()) {
      setError("質問を入力してください");
      return;
    }

    const validChoices = choices.filter((c) => c.trim());
    if (validChoices.length < MIN_SESSION_CHOICES) {
      setError(`選択肢は${MIN_SESSION_CHOICES}つ以上必要です`);
      return;
    }

    setLoading(true);

    try {
      const body: CreateSessionRequest = {
        question,
        voteType,
        choices: validChoices.map((text) => ({ text })),
      };

      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: CreateSessionResponse = await res.json();

      if (!res.ok) {
        setError((data as { error?: string }).error || "投票セッションの作成に失敗しました");
        return;
      }

      // 主催者ビューへ遷移
      router.push(`/vote/${data.sessionId}?view=organizer`);
    } catch {
      setError("投票セッションの作成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8 md:py-10">
      <div className="mx-auto max-w-2xl">
        <Card className="bg-white/90 backdrop-blur-md border-slate-200/80 shadow-[0_16px_32px_rgba(15,23,42,0.12)] rounded-[14px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl tracking-tight">投票を作成</CardTitle>
            <p className="mt-1 text-sm text-slate-500">タイトルと選択肢を入力して投票を作成</p>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="space-y-2" id="question">
                <Label htmlFor="question">タイトル</Label>
                <Input
                  id="question"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例: 今日の昼食は何がいいですか？"
                  required
                />
              </div>

              <div className="space-y-2" id="vote-type">
                <Label className="font-semibold">投票形式</Label>
                <RadioGroup
                  defaultValue="single"
                  className="flex flex-wrap gap-4 text-sm"
                  onValueChange={(value) => setVoteType(value as VoteType)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single">単一選択</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="multiple" id="multiple" />
                    <Label htmlFor="multiple">複数選択</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2" id="choices">
                <Label className="font-semibold">選択肢</Label>
                <div className="space-y-3 rounded-xl border border-dashed border-blue-500/40 bg-slate-50/80 p-4">
                  {choices.map((choice, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center"
                    >
                      <Input
                        type="text"
                        value={choice}
                        onChange={(e) => handleChoiceChange(index, e.target.value)}
                        placeholder="選択肢を入力"
                        required
                        aria-label={`選択肢${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={choices.length <= MIN_SESSION_CHOICES}
                        onClick={() => handleRemoveChoice(index)}
                        className="disabled:bg-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddChoice}
                      disabled={choices.length >= MAX_SESSION_CHOICES}
                    >
                      <Plus className="mr-1 h-4 w-4" /> 選択肢を追加
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50/90">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 rounded-xl px-6 shadow-[0_6px_18px_rgba(37,99,235,0.35)] hover:shadow-[0_10px_24px_rgba(37,99,235,0.4)]"
                >
                  {loading ? "作成中…" : "投票を作成"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
