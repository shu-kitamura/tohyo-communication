import { Link } from "react-router-dom";

import { SiteHeader } from "../components/site-header";

const features = [
  {
    number: "01",
    title: "ログインなしで参加",
    description: "参加者は共有されたURLやQRコードを開くだけ。アカウント登録は不要です。",
  },
  {
    number: "02",
    title: "結果をリアルタイム共有",
    description: "投票結果をその場で更新。会場の反応を全員で見ながら進行できます。",
  },
  {
    number: "03",
    title: "シンプルな主催者操作",
    description: "質問の作成、投票開始、終了までをひとつのルームで管理できます。",
  },
];

const steps = [
  {
    title: "投票ルームを作る",
    description: "ルームを作成し、主催者画面で質問と選択肢を追加します。",
  },
  {
    title: "参加URLを共有する",
    description: "会場のスクリーンやチャットで参加者へ案内します。",
  },
  {
    title: "みんなで投票する",
    description: "集まった回答をリアルタイムで確認します。",
  },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-[#f8fbff]">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/70">
          <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_18%_8%,rgba(14,165,233,0.16),transparent_34rem),radial-gradient(circle_at_90%_70%,rgba(99,102,241,0.12),transparent_30rem)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-30">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-xs font-bold tracking-[0.12em] text-sky-700 shadow-sm">
                REAL-TIME POLLING
              </p>
              <h1 className="max-w-2xl text-4xl leading-[1.12] font-bold tracking-[-0.04em] text-slate-950 sm:text-6xl">
                その場の声を、
                <br />
                <span className="text-sky-600">ひとつの画面へ。</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                イベントやワークショップで使える、ログイン不要のリアルタイム投票。
                参加者の意見をすぐに集めて、会場全体で共有できます。
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  className="inline-flex min-h-13 items-center justify-center gap-3 rounded-xl bg-sky-600 px-7 py-3 text-base font-bold text-white shadow-lg shadow-sky-200 transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                  to="/rooms/"
                >
                  投票を作成する
                  <span aria-hidden="true">→</span>
                </Link>
                <span className="text-sm font-medium text-slate-500">登録不要・すぐに開始</span>
              </div>
            </div>

            <PollPreview />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-18 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.16em] text-sky-700">WHY TOHYO</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              意見を集めるまでを、もっと短く
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                key={feature.number}
              >
                <p className="text-sm font-bold text-sky-600">{feature.number}</p>
                <h3 className="mt-5 text-xl font-bold text-slate-950">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold tracking-[0.16em] text-sky-400">HOW IT WORKS</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                3ステップで投票開始
              </h2>
              <p className="mt-5 leading-7 text-slate-400">
                専用アプリのインストールや参加者登録は必要ありません。
              </p>
            </div>

            <ol className="grid gap-4">
              {steps.map((step, index) => (
                <li
                  className="grid grid-cols-[3rem_1fr] gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                  key={step.title}
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-sky-500/15 text-sm font-bold text-sky-400">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-18 text-center sm:px-8 sm:py-24">
          <p className="text-sm font-bold tracking-[0.16em] text-sky-700">READY?</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            次のイベントで使ってみる
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">
            最初の質問と選択肢を入力すれば、投票ルームの準備は完了です。
          </p>
          <Link
            className="mt-8 inline-flex min-h-13 items-center justify-center rounded-xl bg-slate-950 px-8 py-3 font-bold text-white transition hover:bg-sky-700"
            to="/rooms/"
          >
            投票ルームを作成
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        TOHYO通信 - Vote Communication
      </footer>
    </div>
  );
}

function PollPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-5 -z-10 rotate-3 rounded-[2rem] bg-sky-200/55 blur-sm" />
      <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-2xl shadow-slate-300/70">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-slate-400">LIVE POLL</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">参加者 32人</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-500" />
            投票中
          </span>
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold text-sky-700">QUESTION 01</p>
          <h2 className="mt-2 text-xl font-bold leading-8 text-slate-950">
            次のワークショップで扱いたいテーマは？
          </h2>

          <div className="mt-7 space-y-5">
            <ResultBar label="プロトタイピング" value={72} count={23} />
            <ResultBar label="ユーザーリサーチ" value={47} count={15} />
            <ResultBar label="データ可視化" value={31} count={10} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultBar({ count, label, value }: { count: number; label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold text-slate-950">{count}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
