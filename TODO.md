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

- [ ] event 名を確定する
- [ ] payload 形式を決める
- [ ] 通知を受けたときに再取得する API を決める
- [ ] SSE 再接続時の最新状態取得フローを決める
- [ ] host 専用イベントと参加者向けイベントを分けるか決める

## 実装直前

### D1 schema / migration

- [ ] D1 用の `schema.sql` を作る
- [ ] index / unique 制約を確定する
- [ ] D1 で使える CHECK / FK / transaction の範囲を確認する
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

## 後回しでよい

- [ ] rate limit の詳細
- [ ] 監査ログ
- [ ] host session 一覧
- [ ] host session 強制失効
- [ ] 管理パスワード変更
- [ ] D1 read replication 対応
- [ ] 本番運用時のログ / メトリクス
- [ ] デプロイ手順

## 関連ドキュメント

- `database-design.md`
- `system-design.md`
