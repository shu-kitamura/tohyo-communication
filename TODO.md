# TODO

現在の実装を前提に、残っている判断事項だけを残す。

## 完了済みの前提

- [x] pnpm をパッケージマネージャーにする
- [x] React + Vite + Hono + Cloudflare Vite Plugin を導入する
- [x] D1 / Drizzle schema と migration を作成する
- [x] Durable Object / SSE の基盤を作成する
- [x] Vitest Workers Pool / Playwright を導入する
- [x] D1 を唯一の Source of Truth とする
- [x] DO は room 単位のインメモリ snapshot cache と SSE 配信を担当する
- [x] DO は D1 に直接アクセスしない
- [x] `rooms.state_version` でsnapshot更新順序を管理する
- [x] SSE event名を `room.snapshot` にする
- [x] ホスト/ゲスト共通ルートを `/rooms/:roomId` にする
- [x] `viewerRole` はサーバーからフロントへ返す表示用レスポンス値にする
- [x] ホスト専用APIはホストセッションCookieで検証する
- [x] ゲストから管理パスワードでホストへ切り替えられるようにする
- [x] 複数質問を同時に `active` にできるようにする

## 優先度高

### API / 状態遷移

- [ ] ルーム終了APIを実装するか決める
- [ ] ルーム終了時にactive質問を自動closeするか決める
- [ ] 終了済みルームのゲスト表示を最終結果一覧にするか決める
- [ ] export APIを実装するか決める
- [ ] API error code一覧をドキュメント化する

### ホスト操作

- [ ] 質問の編集/削除を許可するか決める
- [ ] 投票開始後の選択肢変更を禁止するか決める
- [ ] ホストセッションのログアウトを実装するか決める
- [ ] ホストセッション一覧/強制失効を実装するか決める
- [ ] 管理パスワード変更を許可するか決める
- [ ] 管理パスワード入力失敗時のrate limitを入れるか決める

### ゲスト体験

- [ ] 回答済み質問の結果表示タイミングを最終仕様として確定する
- [ ] 未回答の終了済み質問に結果を見せるか決める
- [ ] 複数選択時の割合の母数を決める
- [ ] 投票後に選択内容を明示表示するか決める
- [ ] QRコード表示を実装するか決める

### リアルタイム / 運用

- [ ] DO通知失敗時にoutbox / Queuesが必要になる条件を決める
- [ ] SSE接続数や再接続のメトリクスを取るか決める
- [ ] heartbeat間隔を設定値化するか決める
- [ ] 古いルーム/投票データの自動削除方針を決める
- [ ] 本番運用時のログ項目を決める

## 後回しでよい

- [ ] 監査ログ
- [ ] D1 read replication対応
- [ ] テーマ/ブランド調整
- [ ] CSV/JSON exportのUI
- [ ] `format=image` export
- [ ] デプロイ手順の詳細化

## 関連ドキュメント

- [`docs/system-design.md`](./docs/system-design.md)
- [`docs/api.md`](./docs/api.md)
- [`docs/auth-and-sessions.md`](./docs/auth-and-sessions.md)
- [`docs/database-design.md`](./docs/database-design.md)
- [`docs/realtime.md`](./docs/realtime.md)
