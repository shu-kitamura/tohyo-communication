import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-950">ページが見つかりません</h1>
      <Link className="mt-6 inline-block text-sky-700 hover:text-sky-900" to="/">
        トップへ戻る
      </Link>
    </main>
  );
}
