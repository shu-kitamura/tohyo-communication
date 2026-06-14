# 実装計画: 参加者別SSE snapshot配信

## 概要

回答済み参加者が `room.snapshot` を受信するたびにルームAPIを再取得する挙動を廃止する。Workerが匿名セッションから回答済み質問を判定し、Durable Objectが接続ごとの公開範囲でsnapshotを配信する。

## 要件

- 投票済み参加者のSSE受信による `GET /api/rooms/:roomId` 増幅をなくす
- 回答済み質問の結果はリアルタイム更新する
- 未回答質問の結果は参加者へ公開しない
- ホスト向け全結果配信と未投票参加者向け配信を維持する

## アーキテクチャ変更

- `src/server/index.ts`: SSE接続時にCookieとD1から回答済み質問IDを取得し、DOへ渡す
- `src/durable-objects/room-events.ts`: 接続ごとに回答済み質問IDを保持してsnapshotを絞り込む
- `src/client/pages/room-page.tsx`: SSE payloadを直接反映し、投票成功後だけ接続を張り直す
- `docs/realtime.md`: 参加者別公開範囲と投票後再接続を記録する
- `tests/worker/voting-flow.test.ts`: SSEの結果公開範囲とリアルタイム更新を検証する
- `tests/e2e/room.spec.ts`: SSE更新でルームAPIが再取得されないことを検証する

## 実装手順

### フェーズ1: 配信経路

1. **Workerで公開範囲を決定する** (File: `src/server/index.ts`)
   - Action: 参加者の匿名セッションCookieから回答済み質問IDを取得し、DO内部リクエストへ付与する
   - Why: ブラウザ申告による未回答結果の取得を防ぐため
   - Dependencies: なし
   - Risk: 中

2. **接続別snapshotを生成する** (File: `src/durable-objects/room-events.ts`)
   - Action: SSEクライアントごとに回答済み質問IDを保持し、`snapshotForAudience` へ渡す
   - Why: 同じroomの参加者ごとに異なる結果公開範囲を適用するため
   - Dependencies: ステップ1
   - Risk: 中

3. **クライアント再取得を廃止する** (File: `src/client/pages/room-page.tsx`)
   - Action: SSE snapshotを直接反映し、投票成功後のみEventSourceを再接続する
   - Why: 参加者数と投票数に比例するルームAPI再取得を除去するため
   - Dependencies: ステップ1、2
   - Risk: 中

### フェーズ2: 検証

1. **Workerテストを追加する** (File: `tests/worker/voting-flow.test.ts`)
   - Action: 回答済み結果だけがSSE配信され、その後の投票でリアルタイム更新されることを検証する
   - Why: サーバー側の公開範囲を保証するため
   - Dependencies: フェーズ1
   - Risk: 中

2. **E2Eテストを追加する** (File: `tests/e2e/room.spec.ts`)
   - Action: 投票後のSSE通知で参加者ルームAPIのGET回数が増えないことを検証する
   - Why: 再取得増幅の回帰を防ぐため
   - Dependencies: フェーズ1
   - Risk: 中

3. **全品質チェックを実行する** (File: repository-wide)
   - Action: `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm build` を実行する
   - Why: 型、配信、投票フロー、ビルドへの回帰がないことを確認するため
   - Dependencies: フェーズ2
   - Risk: 中

## テスト戦略

- ユニットテスト: 既存の `snapshotForAudience` 公開範囲テストを維持する
- Workerテスト: Cookie由来の回答済み質問だけをSSEで公開し、票数更新を受信する
- E2Eテスト: 投票後のSSE更新でルームAPI再取得が発生しないことを数える
- 全体検証: check、test、E2E、build

## リスクと対策

- **Risk**: 投票直後に古い公開範囲のSSEがPOSTレスポンスを上書きする
  - Mitigation: 古いEventSourceを無効化してからPOST snapshotを反映し、新しい公開範囲で再接続する
- **Risk**: 回答済み質問IDをクエリ改ざんされる
  - Mitigation: 公開URLの入力を使わず、WorkerがCookieとD1から決定してDO内部URLへ渡す
- **Risk**: host接続で結果が欠落する
  - Mitigation: host audienceは従来どおり全snapshotを返し、Workerテストで確認する

## 成功基準

- [x] SSE受信時に参加者ルームAPIを再取得しない
- [x] 回答済み質問の結果がSSEで更新される
- [x] 未回答質問の結果がSSEに含まれない
- [x] ホストのリアルタイム更新が維持される
- [x] `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm build` が成功する
