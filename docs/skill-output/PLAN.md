# 実装計画: ルーム終了とデータ保持期限

## 概要

ホストがルーム全体を終了できる操作を追加し、終了時に受付中の質問もまとめて終了する。終了済みルームは30日間保持した後、Cloudflare Cron TriggerからD1の親レコードを削除し、関連する質問・投票・セッションをcascadeで削除する。

## 要件

- ホスト画面に不可逆な「ルームを終了」操作を追加する。
- ルーム終了時にactive質問をすべてclosedにする。
- 終了後は質問追加・開始・投票を受け付けない。
- 終了済みルームは最終状態を30日間参照できる。
- 終了から30日経過したルームを日次Cronで完全削除する。
- openルームは自動削除しない。

## アーキテクチャ変更

- `src/server/index.ts`: ルーム終了APIとscheduled handlerを追加する。
- `src/server/retention.ts`: 保持期限の計算と終了済みルーム削除処理を追加する。
- `src/client/pages/host-room-page.tsx`: ルーム終了操作と終了済み表示を追加する。
- `src/server/db/schema.ts`, `drizzle/`: `status + closed_at` の削除検索用indexを追加する。
- `wrangler.jsonc`: 日次Cron Triggerを追加する。

## 実装手順

### フェーズ1: ルーム終了

1. **ルーム終了APIを追加する** (File: `src/server/index.ts`)
   - Action: ホスト認証とrate limit後、active質問をclosedへ変更し、roomをclosedへ変更してsnapshotを配信する。
   - Why: ルーム全体の受付を一操作で確実に停止するため。
   - Dependencies: なし
   - Risk: 中

2. **ホスト画面に終了操作を追加する** (File: `src/client/pages/host-room-page.tsx`)
   - Action: 確認ダイアログ付きの終了ボタン、処理中表示、終了後の操作無効化を追加する。
   - Why: 誤操作を抑えながらホスト自身が受付を停止できるようにするため。
   - Dependencies: ステップ1
   - Risk: 中

### フェーズ2: 自動削除

1. **保持期限削除処理を追加する** (File: `src/server/retention.ts`)
   - Action: `closed_at` が30日前以前のclosedルームを削除し、削除件数を構造化ログへ出す。
   - Why: 投票データと認証情報を必要以上に保持しないため。
   - Dependencies: なし
   - Risk: 高

2. **Cron Triggerを追加する** (File: `wrangler.jsonc`, `src/server/index.ts`)
   - Action: 毎日UTC 18:00にscheduled handlerから保持期限削除処理を実行する。
   - Why: 日本時間03:00に定期的な削除を自動実行するため。
   - Dependencies: ステップ1
   - Risk: 中

3. **削除検索用indexを追加する** (File: `src/server/db/schema.ts`, `drizzle/*.sql`)
   - Action: `rooms(status, closed_at)` indexを追加する。
   - Why: 保存データが増えた場合も期限対象の検索を安定させるため。
   - Dependencies: なし
   - Risk: 低

### フェーズ3: テストと文書

1. **API・cascade削除テストを追加する** (File: `tests/worker/*.test.ts`)
   - Action: active質問の一括終了、終了後の投票拒否、期限経過ルームと関連行の削除を検証する。
   - Why: 不可逆操作と削除処理の回帰を防ぐため。
   - Dependencies: フェーズ1、2
   - Risk: 中

2. **E2Eと仕様書を更新する** (File: `tests/e2e/room.spec.ts`, `docs/*.md`, `TODO.md`)
   - Action: ホスト操作からゲスト終了表示までを検証し、30日保持と完全削除を記録する。
   - Why: UI導線と運用ルールを一致させるため。
   - Dependencies: 全実装
   - Risk: 低

## テスト戦略

- Workerテスト: ルーム終了、active質問の一括終了、終了後の投票拒否
- 保持期限テスト: 30日経過したclosedルームだけ削除し、全子テーブルがcascade削除されること
- E2Eテスト: ホストがルームを終了し、ゲストに終了状態が配信されること
- 静的検査: `pnpm check`
- 回帰テスト: `pnpm test`
- ブラウザテスト: `pnpm test:e2e`
- ビルド: `pnpm build`

## リスクと対策

- **Risk**: ホストが誤ってルームを終了する。
  - Mitigation: 不可逆であることと30日後の削除を確認ダイアログに明記する。
- **Risk**: 削除対象の条件ミスでopenルームを消す。
  - Mitigation: `status = 'closed' AND closed_at <= cutoff` を必須条件とし、境界テストを追加する。
- **Risk**: 一部テーブルだけ残りデータ不整合になる。
  - Mitigation: roomsを親として削除し、既存のON DELETE CASCADEを利用して全関連行を削除する。
- **Risk**: 7日では確認・復旧期間が短い。
  - Mitigation: export未実装の現段階では30日保持とし、export提供後に短縮を再検討する。

## 成功基準

- [x] ホストがルーム全体を終了できる。
- [x] 受付中の質問が同時に終了する。
- [x] 終了後の質問追加・開始・投票が拒否される。
- [x] 終了後30日以内のルームは保持される。
- [x] 終了後30日を超えたルームと全関連データが削除される。
- [x] `pnpm check`、`pnpm test`、`pnpm test:e2e`、`pnpm build`が成功する。
