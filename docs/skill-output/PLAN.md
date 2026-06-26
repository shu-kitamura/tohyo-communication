# 実装計画: ホストSSEのセッション期限終了

## 概要

Issue #39では、接続開始後にホストセッション期限をまたいだSSE接続がホスト向けsnapshotを受け続ける問題を修正する。今回は第一対応として、接続開始時に検証済みホストセッションの`expires_at`をDurable Objectへ渡し、期限到達時にホストSSEストリームを終了する。

## 要件

- SSE接続開始時にWorkerで検証したホストセッションの`expires_at`をDOへ渡す。
- DOはホスト接続だけ期限タイマーを持ち、期限到達時にストリームを閉じる。
- ストリーム終了後の再接続ではWorkerがCookieを再検証し、期限切れなら参加者として接続する。
- 有効なホストと参加者向けの既存SSE配信は維持する。
- 期限切れ後にホスト向けsnapshotが配信されないことをWorker/APIレベルで確認する。

## アーキテクチャ変更

- `src/server/index.ts`: SSEルートでホスト認証結果の`expires_at`を取得し、ホスト接続時だけDOのURLへ渡す。
- `src/durable-objects/room-events.ts`: `SseClient`に期限タイマーを保持し、ホストセッション期限到達時にストリームを閉じる。
- `tests/worker/voting-flow.test.ts`: 期限が近いホストセッションでSSE接続し、期限後にストリームが閉じ、再接続が参加者snapshotになることを確認する。

## 実装手順

### フェーズ1: Workerの認証情報拡張

1. **認証ヘルパー追加** (File: `src/server/index.ts`)
   - Action: `getAuthorizedHostSession()`を追加し、既存の`isAuthorizedHost()`はそのbooleanラッパーにする。
   - Why: 既存のホスト権限チェック呼び出しを保ちながら、SSEルートだけ期限情報を使えるようにするため。
   - Dependencies: なし
   - Risk: 低

2. **SSE URLへ期限を追加** (File: `src/server/index.ts`)
   - Action: ホストとして認証された場合に`hostSessionExpiresAt`クエリをDOへ渡す。
   - Why: DOがD1へアクセスせずに期限到達を判断できるようにするため。
   - Dependencies: ステップ1
   - Risk: 低

### フェーズ2: DOの接続終了制御

1. **期限タイマー管理** (File: `src/durable-objects/room-events.ts`)
   - Action: ホスト接続だけ`setTimeout`を設定し、期限到達時に`controller.close()`してクライアントを削除する。
   - Why: 期限切れ後のbroadcast対象からホスト接続を外すため。
   - Dependencies: フェーズ1
   - Risk: 中

2. **後始末の一元化** (File: `src/durable-objects/room-events.ts`)
   - Action: abort/cancel/enqueue失敗/期限到達の全経路でタイマーを解除する。
   - Why: 接続終了後に不要なタイマーが残らないようにするため。
   - Dependencies: ステップ1
   - Risk: 低

## テスト戦略

- ユニット/Workerテスト: `tests/worker/voting-flow.test.ts`に期限到達後のホストSSE終了と再接続時の参加者snapshotを追加する。
- 静的検証: `pnpm check`
- 全体検証: `pnpm test`、`pnpm test:e2e`、`pnpm build`

## リスクと対策

- **Risk**: 期限到達と初期snapshot送信の境界で期限切れホストへsnapshotが送られる。
  - Mitigation: DO側で期限が過去または無効な場合は即時終了し、Worker側でも期限切れセッションはホスト扱いしない。
- **Risk**: タイマー終了後もclient集合に残りbroadcastされる。
  - Mitigation: `closeClient()`経由でcontroller close、タイマー解除、集合削除をまとめる。

## 成功基準

- [ ] ホストSSE接続が`expires_at`到達時に終了する。
- [ ] 期限終了後の同じCookieでの再接続は参加者向けsnapshotになる。
- [ ] 参加者SSEと有効なホストSSEの既存挙動が維持される。
- [ ] 自動テストとビルドが通る。
