import { Link } from "react-router-dom";

interface SiteHeaderProps {
  showCreateLink?: boolean;
}

export function SiteHeader({ showCreateLink = true }: SiteHeaderProps) {
  return (
    <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link className="flex items-center gap-3" to="/" aria-label="TOHYO通信 トップ">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-600 shadow-sm shadow-sky-200">
            <img className="size-7 invert" src="/tohyo-communication.svg" alt="" />
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight text-slate-950">
              TOHYO通信
            </span>
            <span className="hidden text-[0.65rem] font-semibold tracking-[0.18em] text-slate-400 sm:block">
              VOTE COMMUNICATION
            </span>
          </span>
        </Link>

        {showCreateLink ? (
          <Link
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            to="/rooms/"
          >
            投票を作成
          </Link>
        ) : (
          <Link
            className="text-sm font-semibold text-slate-600 transition hover:text-sky-700"
            to="/"
          >
            トップへ戻る
          </Link>
        )}
      </div>
    </header>
  );
}
