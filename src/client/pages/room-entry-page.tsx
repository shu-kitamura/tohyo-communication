import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { roomViewerResponseSchema, type ViewerRole } from "../../shared/api";
import { requestJson } from "../api";
import { SiteHeader } from "../components/site-header";
import { HostRoomPage } from "./host-room-page";
import { RoomPage } from "./room-page";

export function RoomEntryPage() {
  const { roomId = "" } = useParams();
  const [viewerRole, setViewerRole] = useState<ViewerRole>();
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const loadViewer = async () => {
      try {
        const response = await requestJson<unknown>(`/api/rooms/${roomId}/viewer`);
        const parsed = roomViewerResponseSchema.parse(response);

        if (!isCancelled) {
          setViewerRole(parsed.viewerRole);
          setError("");
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "ルーム情報を取得できませんでした。",
          );
        }
      }
    };

    void loadViewer();

    return () => {
      isCancelled = true;
    };
  }, [roomId]);

  if (viewerRole === "host") {
    return <HostRoomPage />;
  }

  if (viewerRole === "guest") {
    return <RoomPage onHostAuthenticated={() => setViewerRole("host")} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader showCreateLink={false} />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <p className="text-xs font-bold tracking-[0.14em] text-sky-700">
            {error ? "ERROR" : "LOADING"}
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
            {error || "ルーム情報を読み込んでいます"}
          </h1>
        </section>
      </main>
    </div>
  );
}
