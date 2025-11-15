'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateSessionRequest, CreateSessionResponse, VoteType } from '@/lib/types';

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-8 text-center">投票セッション作成</h1>

        <form onSubmit={handleSubmit}>
          {/* Question Input */}
          <div className="mb-6">
            <label htmlFor="question" className="block text-sm font-medium mb-2">
              質問を入力してください
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="例：今日の昼食は何がいいですか？"
            />
          </div>

          {/* Vote Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">投票形式</label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="voteType"
                  value="single"
                  checked={voteType === 'single'}
                  onChange={(e) => setVoteType(e.target.value as VoteType)}
                  className="w-4 h-4 mr-2"
                />
                <span>単一選択</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="voteType"
                  value="multiple"
                  checked={voteType === 'multiple'}
                  onChange={(e) => setVoteType(e.target.value as VoteType)}
                  className="w-4 h-4 mr-2"
                />
                <span>複数選択</span>
              </label>
            </div>
          </div>

          {/* Choices Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">選択肢</label>
            <div className="space-y-2">
              {choices.map((choice, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => handleChoiceChange(index, e.target.value)}
                    className="flex-1 border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`選択肢 ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveChoice(index)}
                    disabled={choices.length <= 2}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddChoice}
              disabled={choices.length >= 10}
              className="mt-2 text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              + 選択肢を追加
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '作成中...' : '投票を作成'}
          </button>
        </form>
      </div>
    </div>
  );
}
