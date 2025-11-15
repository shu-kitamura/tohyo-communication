'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateSessionRequest, CreateSessionResponse, VoteType } from '@/lib/types';

import { AlertCircleIcon, Plus, X } from "lucide-react"

import {
  Alert,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [voteType, setVoteType] = useState<VoteType>('single');
  const [choices, setChoices] = useState(['', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddChoice = () => {
    if (choices.length < 10) {
      setChoices([...choices, '']);
    }
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length > 2) {
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
    setError('');

    // Validation
    if (!question.trim()) {
      setError('質問を入力してください');
      return;
    }

    const validChoices = choices.filter((c) => c.trim());
    if (validChoices.length < 2) {
      setError('選択肢は2つ以上必要です');
      return;
    }

    setLoading(true);

    try {
      const body: CreateSessionRequest = {
        question,
        voteType,
        choices: validChoices.map((text) => ({ text })),
      };

      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: CreateSessionResponse = await res.json();

      if (!res.ok) {
        setError((data as { error?: string }).error || '投票セッションの作成に失敗しました');
        return;
      }

      // Redirect to organizer view
      router.push(`/vote/${data.sessionId}?view=organizer`);
    } catch {
      setError('投票セッションの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Card className="mt-10 w-full max-w-2xl">
        <CardHeader>
          <CardTitle>投票ページ作成</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="question">投票タイトル</Label>
              <Input
                id="question"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例: 今日の昼食は何がいいですか？"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>投票形式</Label>
              <RadioGroup defaultValue="single" className="flex" onValueChange={(value) => setVoteType(value as VoteType)}>
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
            <div className="space-y-2">
              <Label>選択肢</Label>                
              {choices.map((choice, index) => (
                <div key={index} className="flex gap-2">
                <Input
                  type="text"
                  value={choice}
                  onChange={(e) => handleChoiceChange(index, e.target.value)}
                  placeholder={`選択肢 ${index + 1}`}
                  required
                />
                <Button variant="outline" disabled={choices.length <= 2} onClick={() => handleRemoveChoice(index)} className="disabled:bg-gray-300">
                  <X />
                </Button>
              </div>
              ))}
              <div>
                <Button type="button" variant="link" onClick={handleAddChoice}>
                  <Plus /> 選択肢を追加
                </Button>
              </div>
            </div>

            {error && 
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            }

            <Button type="submit" disabled={loading}>
              {loading ? '作成中...' : '作成'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
