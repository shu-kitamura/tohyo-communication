# TODO

今日は決めない。実装前に決めることだけを残す。

## 優先度高

### API 設計

- [ ] endpoint 一覧を確定する
- [ ] 各 endpoint の request body を決める
- [ ] 各 endpoint の response body を決める
- [ ] エラー形式を決める
- [ ] `already_voted` などの error code を決める
- [ ] 主催者 API と参加者 API の境界を決める

### 状態遷移

- [ ] `rooms.status` の状態遷移を決める
- [ ] `questions.status` の状態遷移を決める
- [ ] 1ルームで同時に active な質問を1つに制限するか決める
- [ ] active question を切り替えたとき、前の question を自動 close するか決める
- [ ] closed room / closed question の結果表示可否を決める

### Cookie / セッション

- [ ] anonymous session Cookie 名を決める
- [ ] anonymous session Cookie の Path を決める
- [ ] anonymous session Cookie の有効期限を決める
- [ ] host session Cookie 名を決める
- [ ] host session Cookie の Path を決める
- [ ] host session Cookie の有効期限を決める
- [ ] host session の logout / revoke を実装するか決める

### 管理パスワード

- [ ] 最低文字数を決める
- [ ] パスワードハッシュ方式を決める
- [ ] パスワード変更を許可するか決める
- [ ] パスワード入力失敗時の throttling を入れるか決める
- [ ] 複数ホストとして扱う範囲を決める

### SSE イベント

- [x] 基本 event 名を `room.snapshot` にする
- [x] payload を `snapshot + stateVersion` 形式にする
- [x] 通知ごとの D1 再取得は行わず、DO の snapshot で画面を更新する
- [x] SSE 再接続時は Worker が D1 から最新 snapshot を取得して DO を復元する
- [x] host と participant で配信 payload を分ける
- [ ] host / participant の payload 型を確定する
- [ ] DO 通知のリトライ回数とタイムアウトを決める
- [ ] SSE heartbeat の間隔を決める
- [ ] 通知失敗時のログ項目を決める

### DO スナップショット

- [x] D1 を唯一の Source of Truth とする
- [x] DO は room 単位のインメモリ snapshot cache と SSE 配信を担当する
- [x] DO は D1 に直接アクセスしない
- [x] D1 の更新と同じトランザクションで `rooms.state_version` を増やす
- [x] DO は新しい `stateVersion` の snapshot だけを適用する
- [x] DO に票数の差分ではなく絶対値を渡す
- [ ] `RoomSnapshot` の最終的な TypeScript 型を確定する
- [ ] DO 通知失敗時に outbox / Queues が必要になる条件を決める

## 実装直前

### D1 schema / migration

- [ ] D1 用の `schema.sql` を作る
- [ ] index / unique 制約を確定する
- [ ] `rooms.state_version INTEGER NOT NULL DEFAULT 1` を追加する
- [ ] D1 で使える CHECK / FK / transaction の範囲を確認する
- [ ] D1 `batch()` 内で更新後 snapshot を取得できることを検証する
- [ ] question close と vote の競合を条件付き SQL で防ぐ
- [ ] seed data が必要か決める

### 画面フロー

- [ ] ルーム作成画面を決める
- [ ] 主催者画面を決める
- [ ] 管理パスワード入力画面を決める
- [ ] 参加者画面を決める
- [ ] 投票済み表示を決める
- [ ] ルーム終了表示を決める
- [ ] 質問終了表示を決める

### 集計仕様

- [ ] 得票数だけ表示するか、割合も表示するか決める
- [ ] 複数選択時の割合の母数を決める
- [ ] 投票者数を表示するか決める
- [ ] 結果を参加者にも常時見せるか決める
- [ ] active 中の質問の結果を見せるか決める
- [ ] participant 用 snapshot から results を除外する条件を決める

## 後回しでよい

- [ ] rate limit の詳細
- [ ] 監査ログ
- [ ] host session 一覧
- [ ] host session 強制失効
- [ ] 管理パスワード変更
- [ ] D1 read replication 対応
- [ ] 通知の確実な配信が必要になった場合の outbox / Queues 対応
- [ ] 本番運用時のログ / メトリクス
- [ ] デプロイ手順

## 関連ドキュメント

- `docs/database-design.md`
- `docs/system-design.md`
