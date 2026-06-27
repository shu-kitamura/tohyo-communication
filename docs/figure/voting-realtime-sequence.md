# 投票・リアルタイム更新シーケンス図

ゲストが投票してから、D1更新、snapshot生成、Durable Object経由のSSE配信までの流れです。

```mermaid
sequenceDiagram
  autonumber
  actor Guest as ゲスト
  participant Worker as Cloudflare Workers<br/>Hono API
  participant D1 as Cloudflare D1
  participant DO as RoomEvents Durable Object
  actor Host as ホスト
  actor VotedGuest as 回答済みゲスト

  Host->>Worker: GET /api/rooms/:roomId/events
  Worker->>D1: 最新snapshot取得
  Worker->>DO: POST /snapshot
  Worker->>DO: GET /events?audience=host
  DO-->>Host: SSE接続開始<br/>room.snapshot

  VotedGuest->>Worker: GET /api/rooms/:roomId/events
  Worker->>D1: 最新snapshot取得<br/>回答済み質問ID取得
  Worker->>DO: POST /snapshot
  Worker->>DO: GET /events?audience=participant
  DO-->>VotedGuest: SSE接続開始<br/>回答済み質問だけroom.snapshot

  Guest->>Worker: POST /api/rooms/:roomId/questions/:questionId/votes
  Worker->>Worker: rate limit / 入力検証<br/>匿名セッションCookie確認
  Worker->>D1: 質問状態と選択肢を確認
  Worker->>D1: votes / vote_options INSERT<br/>rooms.state_version更新

  alt 質問が受付終了している
    D1-->>Worker: active質問なし
    Worker-->>Guest: 409 question_not_active
  else 同じ匿名セッションで投票済み
    D1-->>Worker: unique制約違反
    Worker-->>Guest: 409 already_voted
  else 投票成功
    Worker->>D1: 最新snapshot生成
    Worker->>DO: POST /snapshot
    DO->>DO: stateVersion確認<br/>snapshot cache更新
    DO-->>Host: SSE room.snapshot<br/>全質問の結果
    DO-->>VotedGuest: SSE room.snapshot<br/>回答済み質問の結果
    Worker->>D1: 投票者の回答済み質問ID取得
    Worker-->>Guest: 201 投票完了<br/>回答済み質問だけsnapshot
    Guest->>Worker: GET /api/rooms/:roomId/events
    Worker->>D1: 最新snapshot取得<br/>回答済み質問ID取得
    Worker->>DO: GET /events?audience=participant
    DO-->>Guest: SSE room.snapshot<br/>今回回答した質問の結果
  end
```

## 補足

- 投票データの永続化と重複投票チェックはD1で行います。
- `rooms.state_version` を更新し、D1から作った絶対値のsnapshotをDurable Objectへ渡します。
- Durable ObjectはD1へ直接アクセスせず、受け取ったsnapshotを接続中クライアントへ配信します。
- ホストには全質問の結果を配信し、ゲストには回答済み質問の結果だけを配信します。
- ゲストは投票成功後、今回回答した質問の結果を受け取るためにSSE接続を張り直します。
