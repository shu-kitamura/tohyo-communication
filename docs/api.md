# API

APIはCloudflare Workers上のHonoで実装しています。入力検証は共有Zod schemaを使い、定義は [`src/shared/api.ts`](../src/shared/api.ts) にあります。

エラーは基本的に以下の形です。

```json
{
  "error": "表示用メッセージ",
  "code": "machine_readable_code"
}
```

## 更新リクエストの共通要件

`POST` などの更新リクエストは、以下をすべて満たす必要があります。

- `Origin` がリクエスト先Originと完全一致する
- `Sec-Fetch-Site: same-origin`
- `X-TOHYO-Request: 1`

ブラウザ側の `requestJson` が `X-TOHYO-Request` を自動で付与します。JSONを受け取るAPIは `Content-Type: application/json` を必須とし、本文サイズの上限は16KBです。

## Rate limit

公開APIにはWorkers Rate Limiting bindingを適用します。制限超過時は `429` と `Retry-After: 60` を返します。

```json
{
  "error": "リクエストが多すぎます。しばらく待ってから再度お試しください。",
  "code": "rate_limited"
}
```

| 対象 | 上限 | 主な識別単位 |
| --- | ---: | --- |
| 公開API全体 | 1,000回/分 | 接続元IP |
| ルーム作成 | 10回/分 | 接続元IP |
| ホストセッション取得 | 10回/分 | roomId + 接続元IP |
| ホスト更新操作 | 60回/分 | roomId + 接続元IP |
| 投票 | 20回/分 | roomId + 匿名セッション |
| ルーム参照 | 120回/分 | roomId + セッション |
| SSE再接続 | 20回/分 | roomId + セッション |

全APIのIP単位上限を粗い防御として先に適用し、その内側で用途別の上限を適用します。Cookieがない場合も接続元IPをfallbackとして使います。Rate Limiting bindingはCloudflareロケーション単位かつ結果整合であり、厳密な回数管理には使いません。

## Public config

| Method | Path | 説明 |
| --- | --- | --- |
| `GET` | `/api/public-config` | Turnstile site keyを返す |

## Health

| Method | Path | 説明 |
| --- | --- | --- |
| `GET` | `/api/health` | D1接続とruntime確認 |

## Rooms

### `POST /api/rooms`

ルームを作成し、初回ホストセッションCookieを発行します。

Request:

```json
{
  "title": "デザイン勉強会",
  "adminPassword": "example-password",
  "turnstileToken": "Turnstileから取得したtoken"
}
```

`turnstileToken` は必須です。WorkerはCloudflare Siteverify APIでtoken、action、hostnameを検証してからPBKDF2とD1書き込みを実行します。

Response:

```json
{
  "roomId": "123e4567-e89b-42d3-a456-426614174000",
  "title": "デザイン勉強会",
  "hostUrl": "/rooms/123e4567-e89b-42d3-a456-426614174000",
  "participantUrl": "/rooms/123e4567-e89b-42d3-a456-426614174000"
}
```

`hostUrl` と `participantUrl` は現在どちらも同じ共通ルートです。実際の表示ロールはサーバーがCookieから判定します。

### `GET /api/rooms/:roomId/viewer`

現在のリクエストがホストかゲストかを返します。

```json
{
  "viewerRole": "host"
}
```

`viewerRole` は表示切り替え用です。ホスト専用APIの権限判定には使いません。

### `GET /api/rooms/:roomId`

ゲスト用のルーム情報を返します。匿名セッションCookieがなければ発行します。

Response:

```json
{
  "title": "デザイン勉強会",
  "snapshot": {},
  "votedQuestionIds": []
}
```

ゲストの `snapshot.resultsByQuestion` には、回答済み質問の結果だけが含まれます。

### `POST /api/rooms/:roomId/host-session`

管理パスワードを検証し、ホストセッションCookieを発行します。

Request:

```json
{
  "adminPassword": "example-password"
}
```

Response:

```json
{
  "viewerRole": "host"
}
```

### `GET /api/rooms/:roomId/host`

ホスト用のルーム情報を返します。ホストセッションCookieが必要です。

### `POST /api/rooms/:roomId/close`

ルーム全体を終了します。ホスト専用です。

- 受付中の質問をすべて `closed` にする
- ルームを `closed` にする
- 終了状態をSSEで配信する
- 終了後は質問追加・開始・投票を受け付けない

この操作は元に戻せません。終了済みルームは30日後に関連データごと自動削除します。

Response:

```json
{
  "snapshot": {
    "roomStatus": "closed"
  }
}
```

## Questions

### `POST /api/rooms/:roomId/questions`

質問を下書きとして追加します。ホスト専用です。

Request:

```json
{
  "title": "次に扱いたいテーマは？",
  "questionType": "single",
  "options": ["プロトタイピング", "ユーザーリサーチ"]
}
```

Response:

```json
{
  "question": {}
}
```

### `POST /api/rooms/:roomId/questions/:questionId/start`

下書き質問を `active` にします。ホスト専用です。複数質問を同時に `active` にできます。

Response:

```json
{
  "snapshot": {}
}
```

### `POST /api/rooms/:roomId/questions/:questionId/close`

受付中質問を `closed` にします。ホスト専用です。

Response:

```json
{
  "snapshot": {}
}
```

## Votes

### `POST /api/rooms/:roomId/questions/:questionId/votes`

ゲストの投票を受け付けます。

Request:

```json
{
  "optionIds": ["option-id"]
}
```

Response:

```json
{
  "message": "投票を受け付けました。",
  "snapshot": {},
  "votedQuestionIds": ["question-id"]
}
```

重複投票は `already_voted` で `409` を返します。

## Events

### `GET /api/rooms/:roomId/events`

SSE endpointです。ホストセッションCookieが有効ならホスト用snapshot、そうでなければゲスト用snapshotを配信します。

配信イベント名:

```text
room.snapshot
```

## データ保持

Cloudflare Cron Triggerを毎日03:00 JSTに実行し、`closed_at` から30日経過した終了済みルームを削除します。削除対象はルーム、質問、選択肢、投票、投票選択肢、ホストセッションです。終了していないルームは自動削除しません。
