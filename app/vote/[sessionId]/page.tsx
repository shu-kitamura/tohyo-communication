'use client';

import { AlertCircleIcon, Copy, Download } from 'lucide-react';

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
  CartesianGrid,
  Legend,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import { Choice, GetSessionResponse, SubmitVoteRequest } from '@/lib/types';

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Toaster, toast } from "sonner"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from "@/components/ui/checkbox"


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
        const res = await fetch(`/api/vote/${sessionId}`);
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

    const eventSource = new EventSource(`/api/vote/${sessionId}/stream`);

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
      const res = await fetch(`/api/vote/${sessionId}`, {
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
    try {
      await fetch(`/api/vote/${sessionId}/close`, { method: 'POST' });
      setMessage('投票を終了しました');
      window.location.reload();
    } catch {
      setError('投票の終了に失敗しました');
    }
  };

  // Export data
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/vote/${sessionId}/export?format=${format}`);
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
          {/* Menu Area */}
          <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-center justify-between">
            <Tabs
              value={chartType}
              onValueChange={(value) => setChartType(value as 'bar' | 'pie')}
              className="w-[400px]"
            >
              <TabsList>
                <TabsTrigger value="bar">
                  <Label>棒グラフ</Label>
                </TabsTrigger>
                <TabsTrigger value="pie">
                  <Label>円グラフ</Label>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" aria-label="Open menu" size="default">
                    <Download /><Label>ダウンロード</Label>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                  <DropdownMenuLabel>データ形式</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => handleExport('csv')}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleExport('json')}>
                      JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleExport('json')}>
                      画像
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="destructive" className="hover:bg-red-700">
                    <Label>投票を終了</Label>
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <Label>投票を終了しますか？</Label>
                  <div className="flex justify-start gap-2 mt-4">
                    <Button variant="destructive" className="hover:bg-red-700" onClick={handleCloseSession}>
                      <Label>はい</Label>
                    </Button>
                    <Button variant="outline" className="bg-white hover:bg-gray-200">
                      <Label>いいえ</Label>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Chart Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="w-full lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-2xl">{session.question}</CardTitle>
                <CardDescription>総投票数: {totalVotes}票</CardDescription>
              </CardHeader>
              <CardContent className="h-96">
                {chartType === 'bar' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{top: 20}}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                      />
                      <Bar
                        dataKey="votes"
                        fill="#5382daff"
                        radius={10}
                        maxBarSize={100}
                        className="m-10"
                        isAnimationActive={false}
                      >
                        <LabelList
                          position="top"
                          offset={12}
                          fontSize={12}
                          fill='#000000'
                        />
                      </Bar>
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
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="votes"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* QR Code Area */}
            <Card>
              <CardHeader>
                <CardTitle className="text-center">投票用QRコード</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                  <QRCodeSVG value={voteUrl} size={200} />
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-600 break-all">{voteUrl}</p>
                    <Toaster />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" onClick={() => {
                          navigator.clipboard.writeText(voteUrl)
                          toast.success("URLをコピーしました")
                        }}>
                          <Copy />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>URLをコピー</TooltipContent>
                    </Tooltip>
                  </div>
              </CardContent>
            </Card>
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
      <Card className="shadow-lg p-8 max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl">{session.question}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            {session.voteType === 'single' ? 
              <RadioGroup onValueChange={(value) => handleChoiceChange(value)}>
                {session.choices.map((choice) => (
                  <div key={choice.choiceId} className="flex items-center space-x-2 mr-6">
                    <RadioGroupItem value={choice.choiceId} id={choice.choiceId} />
                    <Label htmlFor={choice.choiceId} className="text-xl">{choice.text}</Label>
                  </div>
                ))}
              </RadioGroup>
              : 
              <div className="space-y-2">
                {session.choices.map((choice) => (
                  <div key={choice.choiceId} className="flex items-center space-x-2 mr-6">
                    <Checkbox
                      value={choice.choiceId}
                      id={choice.choiceId}
                      checked={selectedChoices.includes(choice.choiceId)}
                      onCheckedChange={() => handleChoiceChange(choice.choiceId)}
                    />
                    <Label htmlFor={choice.choiceId} className="text-xl">{choice.text}</Label>
                  </div>
                ))}
              </div>
          }

            {error && 
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            }
            <Button type="submit">
              <Label>投票する</Label>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
