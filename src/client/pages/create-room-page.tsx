import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { publicConfigResponseSchema } from "../../shared/api";
import { requestJson } from "../api";
import { SiteHeader } from "../components/site-header";
import { TurnstileWidget } from "../components/turnstile-widget";
import type { RoomCreationNavigationState } from "../types/room";

export function CreateRoomPage() {
  const navigate = useNavigate();
  const [roomTitle, setRoomTitle] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    let isCancelled = false;

    requestJson<unknown>("/api/public-config")
      .then((response) => publicConfigResponseSchema.parse(response))
      .then((config) => {
        if (!isCancelled) {
          setTurnstileSiteKey(config.turnstileSiteKey);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSecurityError(
            "セキュリティ確認を読み込めませんでした。ページを再読み込みしてください。",
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!roomTitle.trim() || !adminPassword) {
      setError("ルーム名と管理パスワードを入力してください。");
      return;
    }

    if (adminPassword.length < 8) {
      setError("管理パスワードは8文字以上で入力してください。");
      return;
    }

    if (!turnstileToken) {
      setError("セキュリティ確認が完了するまでお待ちください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requestJson<{
        roomId: string;
        title: string;
        hostUrl: string;
      }>("/api/rooms", {
        body: JSON.stringify({
          title: roomTitle,
          adminPassword,
          turnstileToken,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const navigationState: RoomCreationNavigationState = {
        roomTitle: response.title,
      };

      navigate(response.hostUrl, { state: navigationState });
    } catch (submissionError) {
      setTurnstileToken("");
      setTurnstileResetKey((current) => current + 1);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "ルームを作成できませんでした。",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader showCreateLink={false} />

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-sky-700">CREATE A ROOM</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              投票ルームを作成
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              まずはルームだけを作成します。質問は作成後のホスト画面から追加できます。
            </p>
          </div>
          <p className="text-sm font-medium text-slate-500">入力時間の目安: 30秒</p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <form
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            noValidate
            onSubmit={handleSubmit}
          >
            <FormSection
              description="ゲストが何の投票なのか分かる名前を設定します。"
              number="1"
              title="ルーム情報"
            >
              <FormField label="ルーム名" hint="例: デザイン勉強会 2026" htmlFor="room-title">
                <input
                  className={inputClassName}
                  id="room-title"
                  name="roomTitle"
                  onChange={(event) => setRoomTitle(event.target.value)}
                  placeholder="イベントや会議の名前"
                  required
                  type="text"
                  value={roomTitle}
                />
              </FormField>
            </FormSection>

            <FormSection
              description="ホスト画面を開くときに使用します。ゲストには共有しないでください。"
              number="2"
              title="ホスト設定"
            >
              <FormField
                label="管理パスワード"
                hint="紛失した場合は復旧できません。安全な場所に保管してください。"
                htmlFor="admin-password"
              >
                <input
                  autoComplete="new-password"
                  className={inputClassName}
                  id="admin-password"
                  minLength={8}
                  name="adminPassword"
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="推測されにくいパスワード"
                  required
                  type="password"
                  value={adminPassword}
                />
              </FormField>
            </FormSection>

            <FormSection
              description="自動操作による大量作成を防ぐための確認です。"
              number="3"
              title="セキュリティ確認"
            >
              {turnstileSiteKey ? (
                <TurnstileWidget
                  onError={() =>
                    setSecurityError(
                      "セキュリティ確認を読み込めませんでした。ページを再読み込みしてください。",
                    )
                  }
                  onToken={(token) => {
                    setSecurityError("");
                    setTurnstileToken(token);
                  }}
                  resetKey={turnstileResetKey}
                  siteKey={turnstileSiteKey}
                />
              ) : securityError ? null : (
                <p className="text-sm text-slate-500">セキュリティ確認を読み込んでいます...</p>
              )}
              {securityError ? (
                <p className="text-sm font-medium text-red-700" role="alert">
                  {securityError}
                </p>
              ) : null}
            </FormSection>

            <div className="border-t border-slate-200 bg-slate-50/70 p-6 sm:p-8">
              {error ? (
                <p
                  className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <button
                className="inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-xl bg-sky-600 px-7 py-3 font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:w-auto"
                disabled={
                  isSubmitting ||
                  (Boolean(roomTitle.trim()) && adminPassword.length >= 8 && !turnstileToken)
                }
                type="submit"
              >
                {isSubmitting ? "作成中..." : "ルームを作成"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>

          <aside className="space-y-5 lg:sticky lg:top-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold tracking-[0.14em] text-sky-700">PREVIEW</p>
              <h2 className="mt-3 font-bold text-slate-950">
                {roomTitle.trim() || "ルーム名が表示されます"}
              </h2>
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm font-bold text-slate-700">質問は作成後に追加</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  ホスト画面で質問や選択肢を準備します。
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <h2 className="font-bold">作成後の流れ</h2>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <li>1. 質問と選択肢を追加</li>
                <li>2. ゲストURLを共有</li>
                <li>3. 準備ができたら投票開始</li>
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

function FormSection({
  children,
  description,
  number,
  title,
}: {
  children: React.ReactNode;
  description: string;
  number: string;
  title: string;
}) {
  return (
    <section className="border-b border-slate-200 p-6 last:border-b-0 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-[2.75rem_1fr]">
        <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sm font-bold text-sky-700">
          {number}
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

function FormField({
  children,
  hint,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  hint: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-slate-800" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="mt-2">{children}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}
