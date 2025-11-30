import { Download, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Choice, GetSessionResponse } from '@/lib/types';
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
} from "@/components/ui/card"
import { ResultChart } from './result-chart';

interface OrganizerViewProps {
  session: GetSessionResponse;
  choices: Choice[];
  sessionId: string;
  onCloseSession: () => void;
  onExport: (format: 'json' | 'csv') => void;
}

export function OrganizerView({ 
  session, 
  choices, 
  sessionId, 
  onCloseSession, 
  onExport 
}: OrganizerViewProps) {
  const totalVotes = choices.reduce((sum, c) => sum + c.voteCount, 0);
  const voteUrl = `${window.location.origin}/vote/${sessionId}`;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Menu Area */}
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-2 items-center justify-end">
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
                  <DropdownMenuItem onSelect={() => onExport('csv')}>
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onExport('json')}>
                    JSON
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
                  <Button variant="destructive" className="hover:bg-red-700" onClick={onCloseSession}>
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
          <div className="w-full lg:col-span-3">
            <ResultChart 
              question={session.question} 
              choices={choices} 
              totalVotes={totalVotes} 
            />
          </div>

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
