import { Download, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Choice, GetSessionResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster, toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultChart } from "./result-chart";

interface OrganizerViewProps {
  session: GetSessionResponse;
  choices: Choice[];
  sessionId: string;
  onCloseSession: () => void;
  onExport: (format: "json" | "csv") => void;
}

export function OrganizerView({
  session,
  choices,
  sessionId,
  onCloseSession,
  onExport,
}: OrganizerViewProps) {
  const totalVotes = choices.reduce((sum, c) => sum + c.voteCount, 0);
  const voteUrl = `${window.location.origin}/vote/${sessionId}`;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
            投票結果
          </h1>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  aria-label="CSV / JSON をダウンロード"
                  className="h-11 rounded-xl border-slate-200 bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md"
                >
                  <Download className="h-4 w-4" />
                  ダウンロード
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40" align="end">
                <DropdownMenuLabel>データ形式</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => onExport("csv")}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onExport("json")}>JSON</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="destructive"
                  className="h-11 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white shadow-md hover:bg-red-600"
                >
                  投票を終了
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 rounded-xl border border-slate-200 bg-white/95 shadow-lg">
                <p className="text-sm font-semibold text-slate-900">投票を終了しますか？</p>
                <p className="mt-1 text-xs text-slate-500">終了後も結果は参加者に表示されます。</p>
                <div className="mt-4 flex justify-start gap-2">
                  <Button
                    variant="destructive"
                    className="h-9 rounded-lg bg-red-500 px-4 text-xs font-semibold text-white hover:bg-red-600"
                    onClick={onCloseSession}
                  >
                    はい
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded-lg border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    いいえ
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:items-start">
          <div className="w-full lg:col-span-3">
            <ResultChart question={session.question} choices={choices} totalVotes={totalVotes} />
          </div>

          <div className="space-y-4">
            <Card className="bg-white/92 backdrop-blur-md border-slate-200/80 shadow-[0_16px_32px_rgba(15,23,42,0.12)] rounded-[14px]">
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
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full border-slate-200 bg-white/90"
                        onClick={() => {
                          navigator.clipboard.writeText(voteUrl);
                          toast.success("URLをコピーしました");
                        }}
                      >
                        <Copy className="h-4 w-4" />
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
    </div>
  );
}
