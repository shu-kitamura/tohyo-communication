'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Choice, GetSessionResponse, SubmitVoteRequest } from '@/lib/types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function VoteSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const isOrganizer = searchParams.get('view') === 'organizer';

  const [session, setSession] = useState<GetSessionResponse | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [error, setError] = useState<string>('');

  // Fetch session info
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/vote/${sessionId}`);
        const data: GetSessionResponse = await res.json();

        if (!res.ok) {
          setError(data.message || 'セッションを読み込めませんでした');
          return;
        }

        setSession(data);
        if (data.message) {
          setMessage(data.message);
        }
      } catch {
        setError('セッションを読み込めませんでした');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  // SSE for real-time updates (organizer only)
  useEffect(() => {
    if (!isOrganizer) return;

    const eventSource = new EventSource(`/vote/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.event === 'init' || message.event === 'update') {
          setChoices(message.data.choices || []);
        }

        if (message.event === 'closed') {
          setMessage(message.data.message);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, isOrganizer]);

  // Handle vote submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedChoices.length === 0) {
      setError('選択肢を選んでください');
      return;
    }

    try {
      const body: SubmitVoteRequest = { choiceIds: selectedChoices };
      const res = await fetch(`/vote/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '投票に失敗しました');
        return;
      }

      setMessage(data.message);
      setSelectedChoices([]);
    } catch {
      setError('投票に失敗しました');
    }
  };

  // Handle choice selection
  const handleChoiceChange = (choiceId: string) => {
    if (session?.voteType === 'single') {
      setSelectedChoices([choiceId]);
    } else {
      setSelectedChoices((prev) =>
        prev.includes(choiceId)
          ? prev.filter((id) => id !== choiceId)
          : [...prev, choiceId]
      );
    }
  };

  // Close session
  const handleCloseSession = async () => {
    if (!confirm('投票を終了しますか？')) return;

    try {
      await fetch(`/vote/${sessionId}/close`, { method: 'POST' });
      setMessage('投票を終了しました');
      window.location.reload();
    } catch {
      setError('投票の終了に失敗しました');
    }
  };

  // Export data
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/vote/${sessionId}/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vote-results-${sessionId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('エクスポートに失敗しました');
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
        <p className="text-lg text-red-600">{error || 'エラーが発生しました'}</p>
      </div>
    );
  }

  // Organizer view
  if (isOrganizer) {
    const totalVotes = choices.reduce((sum, c) => sum + c.voteCount, 0);
    const chartData = choices.map((choice) => ({
      name: choice.text,
      votes: choice.voteCount,
      percentage: totalVotes > 0 ? Math.round((choice.voteCount / totalVotes) * 100) : 0,
    }));

    const voteUrl = `${window.location.origin}/vote/${sessionId}`;

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header Controls */}
          <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setChartType('bar')}
                className={`px-4 py-2 rounded ${chartType === 'bar' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                棒グラフ
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-4 py-2 rounded ${chartType === 'pie' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                円グラフ
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleExport('csv')} className="px-4 py-2 bg-green-600 text-white rounded">
                CSV
              </button>
              <button onClick={() => handleExport('json')} className="px-4 py-2 bg-green-600 text-white rounded">
                JSON
              </button>
              <button onClick={handleCloseSession} className="px-4 py-2 bg-red-600 text-white rounded">
                投票を終了
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main Chart Area */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
              <h1 className="text-2xl font-bold mb-2">{session.question}</h1>
              <p className="text-gray-600 mb-4">総投票数: {totalVotes}票</p>

              <div className="h-96">
                {chartType === 'bar' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="votes" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.votes}`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="votes"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Results Summary */}
              <div className="mt-6">
                {choices.map((choice) => {
                  const percentage = totalVotes > 0 ? Math.round((choice.voteCount / totalVotes) * 100) : 0;
                  return (
                    <div key={choice.choiceId} className="mb-2">
                      <div className="flex justify-between">
                        <span>{choice.text}</span>
                        <span>
                          {choice.voteCount}票 ({percentage}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QR Code Sidebar */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">投票用QRコード</h2>
              <div className="flex justify-center mb-4">
                <QRCodeSVG value={voteUrl} size={200} />
              </div>
              <p className="text-xs text-gray-600 break-all">{voteUrl}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Voter view
  if (message || !session.canVote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">
            {message.includes('完了') ? '✓' : message.includes('終了') ? '✕' : 'ⓘ'}
          </div>
          <h2 className="text-2xl font-bold mb-2">{message}</h2>
          {selectedChoices.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-600">あなたの投票:</p>
              {session.choices
                .filter((c) => selectedChoices.includes(c.choiceId))
                .map((c) => (
                  <p key={c.choiceId} className="font-medium">
                    ・{c.text}
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">{session.question}</h1>
        {session.voteType === 'multiple' && (
          <p className="text-sm text-gray-600 mb-4">(複数選択可)</p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-3 mb-6">
            {session.choices.map((choice) => (
              <label
                key={choice.choiceId}
                className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type={session.voteType === 'single' ? 'radio' : 'checkbox'}
                  name="vote"
                  value={choice.choiceId}
                  checked={selectedChoices.includes(choice.choiceId)}
                  onChange={() => handleChoiceChange(choice.choiceId)}
                  className="w-5 h-5 mr-3"
                />
                <span className="text-lg">{choice.text}</span>
              </label>
            ))}
          </div>

          {error && <p className="text-red-600 mb-4">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-medium hover:bg-blue-700 disabled:bg-gray-300"
            disabled={selectedChoices.length === 0}
          >
            投票する
          </button>
        </form>
      </div>
    </div>
  );
}
