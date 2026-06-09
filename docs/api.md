# API

APIはCloudflare Workers上のHonoで実装しています。入力検証は共有Zod schemaを使い、定義は [`src/shared/api.ts`](../src/shared/api.ts) にあります。

エラーは基本的に以下の形です。

```json
{
  "error": "表示用メッセージ",
  "code": "machine_readable_code"
}
```

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
  "adminPassword": "example-password"
}
```

Response:

```json
{
  "roomId": "room-xxxxxxxx",
  "title": "デザイン勉強会",
  "hostUrl": "/rooms/room-xxxxxxxx",
  "participantUrl": "/rooms/room-xxxxxxxx"
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
