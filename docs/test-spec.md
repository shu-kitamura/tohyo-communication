# テスト仕様書

## 1. 概要

バックエンド API のテスト仕様書。  
正常/不正な入力を、正しく扱えているかを確認する。

## 2. テスト方針

- 対象範囲はバックエンド API（/init, /, /vote, /close, /stream, /export）を中心とする
- 正常系・異常系・境界値・状態遷移（作成→投票→終了→削除）の4観点で整理する
- 入力バリデーション（必須項目、型、choices数、voteType）を優先的に確認する
- 重複投票防止（voter_token + DOストレージ照合）と終了後の投票拒否を重点的に確認する
- SSEは「初回データ配信」「投票反映の即時性」「切断時の扱い」を確認する
- エクスポートはCSV/JSONの出力内容と形式を確認する（format=imageは非対象）
- UIの見た目・パフォーマンス・負荷試験は本仕様の対象外とする

## 3. テストケース

### 3.1 セッション作成: POST /api/vote

| ID      | 観点 | 条件/入力                                      | 期待結果                                                |
| ------- | ---- | ---------------------------------------------- | ------------------------------------------------------- |
| INIT-01 | 正常 | questionあり、choices=2〜10、voteType=single   | 201、sessionId/voteUrl/createdAtが返る                  |
| INIT-02 | 正常 | questionあり、choices=2〜10、voteType=multiple | 201、sessionId/voteUrl/createdAtが返る                  |
| INIT-03 | 異常 | questionが空/空白                              | 400、`質問を入力してください`                           |
| INIT-04 | 異常 | choicesが未指定または1件以下                   | 400、`選択肢は2つ以上必要です`                          |
| INIT-05 | 異常 | choicesが11件以上                              | 400、`選択肢は10個までです`                             |
| INIT-06 | 異常 | voteTypeがsingle/multiple以外                  | 400、`投票形式はsingleまたはmultipleを指定してください` |
| INIT-07 | 異常 | DO初期化失敗                                   | 500                                                     |

### 3.2 セッション取得: GET /api/vote/:sessionId

| ID     | 観点 | 条件/入力                                 | 期待結果                                           |
| ------ | ---- | ----------------------------------------- | -------------------------------------------------- |
| GET-01 | 正常 | 既存セッション、未投票                    | 200、`canVote=true`、`message`なし                 |
| GET-02 | 正常 | 既存セッション、投票済み(voter_tokenあり) | 200、`canVote=false`、`message=既に投票済みです`   |
| GET-03 | 正常 | 既存セッション、終了済み                  | 200、`canVote=false`、`message=投票は終了しました` |
| GET-04 | 異常 | 存在しないsessionId                       | 404                                                |
| GET-05 | 異常 | DO内部エラー                              | 500                                                |

### 3.3 投票送信: POST /api/vote/:sessionId

| ID      | 観点 | 条件/入力               | 期待結果                                                                      |
| ------- | ---- | ----------------------- | ----------------------------------------------------------------------------- |
| VOTE-01 | 正常 | 未投票、choiceIdsが有効 | 201、`message=投票が完了しました`、`votedAt`返却、`voter_token`がCookieに設定 |
| VOTE-02 | 異常 | choiceIdsが無効         | 400                                                                           |
| VOTE-03 | 異常 | 投票済みvoter_token     | 409                                                                           |
| VOTE-04 | 異常 | セッション終了後に投票  | 403                                                                           |
| VOTE-05 | 異常 | 存在しないsessionId     | 404                                                                           |

### 3.3.1 投票バリデーション詳細（Durable Object）

choiceIdsの入力バリデーションに関する詳細テストケース。

| ID       | 観点 | 条件/入力                                  | 期待結果                               |
| -------- | ---- | ------------------------------------------ | -------------------------------------- |
| VAL-01   | 異常 | type=single で複数のchoiceIds（例: [1,2]） | 400、`単一選択では1つだけ選んでください` |
| VAL-02   | 正常 | type=single で1つのchoiceId                | 201                                    |
| VAL-03   | 異常 | choiceIdsが空配列（[]）                    | 400、`選択肢を選んでください`          |
| VAL-04   | 異常 | choiceIdsに重複あり（例: [1,1]）           | 400、`重複した選択肢があります`        |
| VAL-05   | 異常 | 存在しないchoiceIdを含む（例: [999]）      | 400、`無効な選択肢が含まれています`    |
| VAL-06   | 異常 | choiceIdsが配列でない（例: "1"）           | 400、`choiceIds must be an array`      |
| VAL-07   | 正常 | type=multiple で複数のchoiceIds            | 201                                    |

### 3.4 投票終了: POST /api/vote/:sessionId/close

| ID       | 観点 | 条件/入力           | 期待結果                             |
| -------- | ---- | ------------------- | ------------------------------------ |
| CLOSE-01 | 正常 | 進行中セッション    | 200、`status=closed`、`closedAt`返却 |
| CLOSE-02 | 正常 | 既に終了済み        | 200、`status=closed`が返る（冪等）   |
| CLOSE-03 | 異常 | 存在しないsessionId | 404                                  |
| CLOSE-04 | 異常 | DO内部エラー        | 500                                  |

### 3.5 SSE: GET /api/vote/:sessionId/stream

| ID        | 観点 | 条件/入力  | 期待結果                                     |
| --------- | ---- | ---------- | -------------------------------------------- |
| STREAM-01 | 正常 | 接続直後   | 200、`text/event-stream`、`event=init`が配信 |
| STREAM-02 | 正常 | 投票発生後 | `event=update`で最新のセッションデータが配信 |
| STREAM-03 | 正常 | 投票終了後 | `event=closed`、`message=投票が終了しました` |

### 3.6 エクスポート: GET /api/vote/:sessionId/export

| ID        | 観点 | 条件/入力           | 期待結果                                          |
| --------- | ---- | ------------------- | ------------------------------------------------- |
| EXPORT-01 | 正常 | format=json         | 200、JSON（totalVotes/percentage/exportedAt含む） |
| EXPORT-02 | 正常 | format=csv          | 200、`text/csv; charset=utf-8`、CSV内容が返る     |
| EXPORT-03 | 異常 | format未指定        | 400                                               |
| EXPORT-04 | 異常 | format=image        | 501                                               |
| EXPORT-05 | 異常 | format不正          | 400                                               |
| EXPORT-06 | 異常 | 存在しないsessionId | 404                                               |
