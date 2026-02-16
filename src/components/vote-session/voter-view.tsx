import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Choice, GetSessionResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ResultChart } from "./result-chart";

interface VoterViewProps {
  session: GetSessionResponse;
  choices: Choice[];
  message: string;
  error: string;
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  onSubmit: (selectedChoices: string[]) => Promise<void>;
}

export function VoterView({
  session,
  choices,
  message,
  error,
  showResults,
  setShowResults,
  onSubmit,
}: VoterViewProps) {
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);

  // 選択肢の選択処理
  const handleChoiceChange = (choiceId: string) => {
    if (session?.voteType === "single") {
      setSelectedChoices([choiceId]);
    } else {
      setSelectedChoices((prev) =>
        prev.includes(choiceId) ? prev.filter((id) => id !== choiceId) : [...prev, choiceId],
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(selectedChoices);
    setSelectedChoices([]);
  };

  // 結果表示ビュー
  if (showResults) {
    const totalVotes = choices.reduce((sum, c) => sum + c.voteCount, 0);
    return (
      <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-semibold text-slate-900 md:text-lg">投票結果</h1>
            <Button variant="outline" size="sm" onClick={() => setShowResults(false)}>
              ← 戻る
            </Button>
          </div>

          <Card className="mt-2 rounded-[14px] border-slate-200/80 bg-white/92 p-4 shadow-[0_16px_32px_rgba(15,23,42,0.12)] backdrop-blur-md">
            <ResultChart question={session.question} choices={choices} totalVotes={totalVotes} />
          </Card>
        </div>
      </div>
    );
  }

  // 投票完了/終了ビュー
  if (message || !session.canVote) {
    return (
      <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="mx-auto max-w-md space-y-4">
          <section className="rounded-[14px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_32px_rgba(15,23,42,0.12)] backdrop-blur-md">
            <div className="space-y-3">
              <div
                className={
                  message.includes("完了")
                    ? "rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
                    : message.includes("終了")
                      ? "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                }
              >
                {message || "この端末では投票済みです"}
              </div>
              <Button onClick={() => setShowResults(true)} className="mt-1 w-full rounded-xl">
                結果を見る
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // 投票フォームビュー
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="mx-auto max-w-xl space-y-4">
        <Card className="rounded-[14px] border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_32px_rgba(15,23,42,0.12)] backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold leading-snug md:text-2xl">
              {session.question}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
              {session.voteType === "single" ? (
                <RadioGroup
                  onValueChange={(value) => handleChoiceChange(value)}
                  className="space-y-1"
                >
                  {session.choices.map((choice) => (
                    <Label
                      key={choice.choiceId}
                      htmlFor={choice.choiceId}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm transition hover:border-blue-500 hover:bg-blue-50/60"
                    >
                      <RadioGroupItem value={choice.choiceId} id={choice.choiceId} />
                      <span className="text-base">{choice.text}</span>
                    </Label>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-3">
                  {session.choices.map((choice) => (
                    <Label
                      key={choice.choiceId}
                      htmlFor={choice.choiceId}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm transition hover:border-blue-500 hover:bg-blue-50/60"
                    >
                      <Checkbox
                        value={choice.choiceId}
                        id={choice.choiceId}
                        checked={selectedChoices.includes(choice.choiceId)}
                        onCheckedChange={() => handleChoiceChange(choice.choiceId)}
                      />
                      <span className="text-base">{choice.text}</span>
                    </Label>
                  ))}
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50/90">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

              <Button type="submit" className="mt-1 h-11 rounded-xl">
                <Label>投票する</Label>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
