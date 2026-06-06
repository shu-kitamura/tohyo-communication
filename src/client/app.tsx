import { useEffect, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";

interface HealthResponse {
  status: string;
  database: string;
  runtime: string;
}

function HomePage() {
  const [health, setHealth] = useState<HealthResponse>();
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setHealthError(true);
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-sky-700">
          REAL-TIME POLLING
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">TOHYO通信</h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          React、Hono、Cloudflare D1、Durable Objectsで構築するリアルタイム投票アプリです。
        </p>
      </div>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <StatusCard label="Frontend" value="React + Vite" />
        <StatusCard label="Backend" value="Hono + Workers" />
        <StatusCard
          label="Environment"
          value={
            healthError
              ? "接続エラー"
              : health
                ? `${health.runtime} / D1 ${health.database}`
                : "確認中..."
          }
        />
      </section>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function RoomPage({ host = false }: { host?: boolean }) {
  const { roomId } = useParams();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link className="text-sm font-medium text-sky-700 hover:text-sky-900" to="/">
        トップへ戻る
      </Link>
      <h1 className="mt-8 text-3xl font-bold text-slate-950">
        {host ? "主催者画面" : "参加者画面"}
      </h1>
      <p className="mt-4 text-slate-600">Room ID: {roomId}</p>
      <p className="mt-2 text-slate-600">投票機能は次の実装フェーズで追加します。</p>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-950">ページが見つかりません</h1>
      <Link className="mt-6 inline-block text-sky-700 hover:text-sky-900" to="/">
        トップへ戻る
      </Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/rooms/:roomId" element={<RoomPage />} />
      <Route path="/rooms/:roomId/host" element={<RoomPage host />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
