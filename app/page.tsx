import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  Zap,
  Smartphone,
  BarChart3,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ヒーローセクション */}
      <section className="relative overflow-hidden py-16 md:py-24 px-4">
        {/* 背景のグラデーション装飾 */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          {/* ロゴ */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Image
              src="/tohyo-communication.svg"
              alt="TOHYO通信 ロゴ"
              width={250}
              height={250}
              priority
            />
          </div>

          {/* キャッチコピー */}
          <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
            リアルタイム投票で、場を盛り上げよう
          </h1>
          <p className="text-base md:text-lg text-slate-600 mb-8 leading-relaxed">
            QRコードを読み取るだけで即参加。
            <br className="hidden sm:block" />
            投票結果がリアルタイムで画面に反映されます。
          </p>

          {/* CTAボタン */}
          <Link href="/vote">
            <Button
              size="lg"
              className="h-14 px-8 text-lg rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:-translate-y-0.5"
            >
              <Plus className="mr-2 h-5 w-5" />
              投票を作成する
            </Button>
          </Link>

          {/* サブテキスト */}
          <div className="mt-6">
            <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium">
              <Check className="h-4 w-4" />
              ログイン不要・無料
            </span>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="py-16 md:py-20 px-4 bg-slate-50/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
            TOHYO通信の特徴
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white/80 backdrop-blur border-slate-200/80 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="pt-8 pb-6 px-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl mx-auto mb-5 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  リアルタイム更新
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  投票結果が瞬時にグラフに反映。会場全体で一体感を演出できます。
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur border-slate-200/80 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="pt-8 pb-6 px-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl mx-auto mb-5 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  QRコードで即参加
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  ログイン不要。スマホでQRコードを読み取るだけで、すぐに投票できます。
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur border-slate-200/80 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="pt-8 pb-6 px-6 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl mx-auto mb-5 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  見やすいグラフ表示
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  棒グラフ・円グラフを切り替え可能。プロジェクター投影にも最適です。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 使い方セクション */}
      <section className="py-16 md:py-20 px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-12">
            使い方
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 開催者向け */}
            <Card className="bg-white/80 backdrop-blur border-slate-200/80 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-5 pb-4 border-b-2 border-blue-600 flex items-center gap-2">
                  開催者の方
                </h3>
                <div className="space-y-5">
                  <Step
                    number={1}
                    title="投票を作成"
                    description="質問と選択肢を入力して投票セッションを作成します。"
                  />
                  <Step
                    number={2}
                    title="QRコードを共有"
                    description="生成されたQRコードをプロジェクターなどで参加者に見せます。"
                  />
                  <Step
                    number={3}
                    title="結果をリアルタイム表示"
                    description="投票結果がリアルタイムでグラフに反映されます。"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 参加者向け */}
            <Card className="bg-white/80 backdrop-blur border-slate-200/80 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-5 pb-4 border-b-2 border-blue-600 flex items-center gap-2">
                  参加者の方
                </h3>
                <div className="space-y-5">
                  <Step
                    number={1}
                    title="QRコードを読み取る"
                    description="開催者が表示するQRコードをスマホで読み取ります。"
                  />
                  <Step
                    number={2}
                    title="選択肢を選んで投票"
                    description="表示された選択肢から選んで送信ボタンを押します。"
                  />
                  <Step
                    number={3}
                    title="結果を確認"
                    description="投票後、リアルタイムで結果を閲覧できます。"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTAセクション */}
      <section className="py-16 md:py-20 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            さっそく始めてみよう
          </h2>
          <p className="text-slate-400 mb-8">
            アカウント登録不要。今すぐ投票セッションを作成できます。
          </p>
          <Link href="/vote">
            <Button
              size="lg"
              className="h-14 px-8 text-lg rounded-xl shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/50 transition-all hover:-translate-y-0.5"
            >
              <Plus className="mr-2 h-5 w-5" />
              投票を作成する
            </Button>
          </Link>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 px-4 text-center text-sm text-slate-500 border-t border-slate-200">
        <p>© 2025 TOHYO通信 - Vote Communication</p>
      </footer>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md shadow-blue-500/30">
        {number}
      </div>
      <div>
        <h4 className="font-medium text-slate-900 mb-1">
          {title}
        </h4>
        <p className="text-sm text-slate-600 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
