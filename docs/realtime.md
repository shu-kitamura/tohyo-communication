# リアルタイム配信

リアルタイム更新はServer-Sent EventsとDurable Objectsで実現しています。

図解: [`docs/figure/voting-realtime-sequence.md`](./figure/voting-realtime-sequence.md)

## 役割分担

| コンポーネント | 役割 |
| --- | --- |
| Worker | D1更新、snapshot生成、DO通知、SSE入口 |
| D1 | 正式なデータ保存場所 |
| RoomEvents Durable Object | room単位のSSE接続管理、snapshotキャッシュ、broadcast |
| Browser | `EventSource` で `room.snapshot` を受信 |

Durable ObjectはD1へ直接アクセスしません。WorkerがD1から生成したsnapshotをDOへ渡します。

## 更新フロー

質問作成、投票開始、投票、投票終了では以下の流れになります。

```text
API request
  -> D1更新
  -> rooms.state_version を増やす
  -> 最新snapshotをD1から生成
  -> RoomEvents DOへPOST /snapshot
  -> DOが接続中ブラウザへroom.snapshotをbroadcast
```

## SSE接続

ブラウザは以下に接続します。

```text
GET /api/rooms/:roomId/events
```

Workerは接続時にD1から最新snapshotを取得し、DOへ投入してからSSE streamを返します。これにより、DOがevictされていても次の接続で復元できます。

参加者接続では、Workerが匿名セッションCookieから回答済み質問IDをD1で取得し、DOへ接続ごとの公開範囲として渡します。回答済み質問が増えた投票成功後だけブラウザがSSE接続を張り直します。

## Snapshot形式

実装上の型は [`src/shared/room-snapshot.ts`](../src/shared/room-snapshot.ts) にあります。

```ts
type RoomSnapshot = {
  roomId: string;
  stateVersion: number;
  roomStatus: "open" | "closed";
  questions: SnapshotQuestion[];
  resultsByQuestion: Record<string, QuestionResults>;
};
```

質問はすべて `questions` に含まれます。複数の質問が同時に `active` になれます。

## ホスト/ゲスト別payload

DOは接続時のaudienceに応じてpayloadを分けます。

| audience | resultsByQuestion |
| --- | --- |
| `host` | 全質問の結果を含む |
| `participant` | 回答済み質問の結果だけ含む |

ゲストが未回答の質問については、結果を配信しません。投票後は該当質問の結果が見えるようになります。
参加者はSSE payloadを直接画面へ反映するため、通知ごとにルームAPIを再取得しません。

## stateVersion

`stateVersion` は古い通知を無視するために使います。

```text
incoming.stateVersion <= current.stateVersion
  -> 無視

incoming.stateVersion > current.stateVersion
  -> キャッシュ更新 + broadcast
```

票数の差分ではなく、常にD1から作った絶対値のsnapshotを配信します。これにより、通知の再送や順序逆転で集計が壊れないようにしています。

## Heartbeat

`RoomEventsDO` は接続中クライアントがいる間、15秒ごとにSSE comment heartbeatを送ります。

```text
: heartbeat
```

クライアントがいなくなるとheartbeat timerを停止します。

## DOの寿命

Durable Objectのメモリ上の寿命はCloudflare側が管理します。アプリは「いつevictされてもよい」前提で作ります。

このアプリでは、DOに保存しているのは以下だけです。

- 接続中SSEクライアント
- 最新snapshotのインメモリキャッシュ
- heartbeat timer

投票データ本体はD1にあるため、DOが落ちても消えません。

## 未実装

- 通知失敗時のoutbox / Queues
- SSE接続数や再接続のメトリクス
- ルーム終了時のSSE明示切断
