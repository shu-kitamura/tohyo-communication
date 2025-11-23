import { useState } from 'react';
import { AlertCircleIcon, CircleCheck, CircleX } from 'lucide-react';
import { Choice, GetSessionResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from "@/components/ui/checkbox"
import { ResultChart } from './result-chart';

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
  onSubmit 
}: VoterViewProps) {
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(selectedChoices);
    setSelectedChoices([]);
  };

  // Show results view
  if (showResults) {
    const totalVotes = choices.reduce((sum, c) => sum + c.voteCount, 0);
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Button variant="outline" onClick={() => setShowResults(false)}>
              ← 戻る
            </Button>
          </div>
          <ResultChart 
            question={session.question} 
            choices={choices} 
            totalVotes={totalVotes} 
          />
        </div>
      </div>
    );
  }

  // Completed or Closed view
  if (message || !session.canVote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="shadow-lg p-8 max-w-md w-full">
          <CardContent className="flex flex-col items-center space-y-6">
            <div className="flex flex-col items-center">
              {message.includes('完了') ? <CircleCheck size={48} className="text-green-500 mb-2" />
                : message.includes('終了') ? <CircleX size={48} className="text-red-500 mb-2" />
                : <AlertCircleIcon size={48} className="text-yellow-500 mb-2" />}
              <p className="text-2xl font-bold text-center">{message}</p>
            </div>
            
            <Button onClick={() => setShowResults(true)} className="w-full">
              結果を見る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Voting Form view
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
                    <p className="text-xl">{choice.text}</p>
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
                    <p className="text-xl">{choice.text}</p>
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
