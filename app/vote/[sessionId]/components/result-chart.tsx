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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Choice } from '@/lib/types';
import { useState } from 'react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

interface ResultChartProps {
  question: string;
  choices: Choice[];
  totalVotes: number;
}

export function ResultChart({ question, choices, totalVotes }: ResultChartProps) {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  const chartData = choices.map((choice) => ({
    name: choice.text,
    votes: choice.voteCount,
    percentage: totalVotes > 0 ? Math.round((choice.voteCount / totalVotes) * 100) : 0,
  }));

  return (
    <Card className="w-full h-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl">{question}</CardTitle>
            <CardDescription>総投票数: {totalVotes}票</CardDescription>
          </div>
          <Tabs
            value={chartType}
            onValueChange={(value) => setChartType(value as 'bar' | 'pie')}
            className="w-[200px]"
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
        </div>
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
  );
}
