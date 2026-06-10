# システム設計

TOHYO通信は、イベントやワークショップ向けのリアルタイム投票アプリです。ホストがルームと質問を作成し、ゲストは共有URLから投票します。

現在の実装では、`/rooms/:roomId` をホスト/ゲスト共通の入口にしています。表示ロールはサーバーがホストセッションCookieを検証して返す `viewerRole` で決まり、URLだけではホスト権限を得られません。

## 構成

| 領域 | 技術 | 役割 |
| --- | --- | --- |
| フロントエンド | React / Vite / React Router / Tailwind CSS | ルーム作成、ホスト画面、ゲスト画面 |
| API | Cloudflare Workers / Hono / Zod | 認証、入力検証、D1操作、SSE入口 |
| 濫用対策 | Workers Rate Limiting / Turnstile | API回数制限、ルーム大量作成のbot対策 |
| 永続化 | Cloudflare D1 / Drizzle | ルーム、質問、選択肢、投票、セッション |
| リアルタイム | Durable Objects / SSE | room単位の接続管理とsnapshot配信 |

```text
Browser
  -> React SPA
  -> REST API
  -> EventSource

Cloudflare Worker
  -> Hono routing
  -> Zod validation
  -> D1 read/write
  -> RoomEvents Durable Object notification

D1
  -> Source of Truth

RoomEvents Durable Object
  -> room_idごとのSSE接続
  -> 最新snapshotのインメモリキャッシュ
```

## 主要ルート

| ルート | 役割 |
| --- | --- |
| `/` | ランディングページ |
| `/rooms/` | ルーム作成 |
| `/rooms/:roomId` | ホスト/ゲスト共通入口 |

`RoomEntryPage` が `GET /api/rooms/:roomId/viewer` を呼び、`viewerRole` が `host` なら `HostRoomPage`、`guest` なら `RoomPage` を表示します。

## ロール判定

ロール判定はサーバー側で行います。

```text
valid host session cookie -> viewerRole: "host"
otherwise                 -> viewerRole: "guest"
```

`viewerRole` は表示切り替え用のレスポンス値です。ホスト専用APIは、必ずサーバー側でホストセッションCookieを再検証します。

詳細: [`docs/auth-and-sessions.md`](./auth-and-sessions.md)

## データ方針

D1を唯一のSource of Truthとします。Durable ObjectはSSE接続と最新snapshotのインメモリキャッシュだけを担当します。DOがevictされても、次のアクセス時にWorkerがD1からsnapshotを再生成できます。

詳細: [`docs/database-design.md`](./database-design.md)

## Snapshot

現在のsnapshotは、ルーム内の全質問と質問別集計を持ちます。

```ts
type RoomSnapshot = {
  roomId: string;
  stateVersion: number;
  roomStatus: "open" | "closed";
  questions: SnapshotQuestion[];
  resultsByQuestion: Record<string, QuestionResults>;
};
```

ホストには全結果を返します。ゲストには、回答済み質問の結果だけを返します。

詳細: [`docs/realtime.md`](./realtime.md)

## 代表フロー

### ルーム作成

1. ホストが `/rooms/` でルーム名と管理パスワードを入力し、Turnstile確認を完了する。
2. `POST /api/rooms` がrate limitとTurnstile tokenを検証する。
3. `rooms` と初回 `host_sessions` をD1へ保存する。
4. WorkerがホストセッションCookieを発行する。
5. フロントは `/rooms/:roomId` へ遷移する。
6. `viewerRole: "host"` と判定され、ホスト画面が表示される。

### ゲスト投票

1. ゲストが `/rooms/:roomId` を開く。
2. `viewerRole: "guest"` と判定され、ゲスト画面が表示される。
3. `GET /api/rooms/:roomId` が匿名セッションCookieを発行または再利用する。
4. ゲストは受付中の質問カードから投票する。
5. 投票後、D1更新、`stateVersion`更新、DO通知、SSE配信が行われる。

### ゲストからホストへ切り替え

1. ゲスト画面下部の「ホストとして開く」を押す。
2. 管理パスワード入力欄が表示される。
3. `POST /api/rooms/:roomId/host-session` が管理パスワードを検証する。
4. 成功するとホストセッションCookieを発行し、同じURLでホスト画面へ切り替える。

### ルーム終了と削除

1. ホストが「ルームを終了」を実行する。
2. Workerが受付中の質問をすべて終了し、ルームを `closed` にする。
3. 終了snapshotをDurable Objectへ通知し、ゲスト画面へ配信する。
4. 終了状態を30日間保持する。
5. 日次Cronが保持期限を過ぎたルームを関連データごと削除する。

## 関連ドキュメント

- [`docs/api.md`](./api.md)
- [`docs/auth-and-sessions.md`](./auth-and-sessions.md)
- [`docs/database-design.md`](./database-design.md)
- [`docs/realtime.md`](./realtime.md)
