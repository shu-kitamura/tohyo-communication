import { useParams } from "react-router-dom";

import { SiteHeader } from "../components/site-header";

export function RoomPage() {
  const { roomId = "" } = useParams();

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader showCreateLink={false} />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-6 py-7 text-white sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <span className="size-2 rounded-full bg-emerald-400" />
                接続中
              </span>
              <span className="text-xs font-semibold tracking-[0.12em] text-slate-400">
                PARTICIPANT VIEW
              </span>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">投票ルーム</h1>
            <p className="mt-2 font-mono text-xs text-slate-400">Room ID: {roomId}</p>
          </div>

          <div className="px-6 py-14 text-center sm:px-8 sm:py-18">
            <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-sky-50 text-2xl font-bold text-sky-600">
              …
            </span>
            <p className="mt-6 text-xs font-bold tracking-[0.14em] text-sky-700">WAITING</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              質問が始まるまでお待ちください
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-500">
              主催者が投票を開始すると、この画面に質問と選択肢が自動で表示されます。
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-sm font-bold text-sky-950">この画面はそのままで大丈夫です</h2>
          <p className="mt-2 text-sm leading-6 text-sky-800">
            リアルタイム更新により、投票開始時に表示内容が切り替わります。
          </p>
        </section>
      </main>
    </div>
  );
}
