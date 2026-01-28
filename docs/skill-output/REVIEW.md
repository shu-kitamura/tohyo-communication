# レビュー結果

スコープ: `app/`, `components/`, `./` 配下の `*.ts`, `*.tsx`（`app/api`, `app/vote`, `lib`, `worker.ts`, `tests` など）

- [Should] 終了・エクスポート操作がHTTPエラーを無視して成功扱いになる
  - `Where` : `app/vote/[sessionId]/page.tsx:148`, `app/vote/[sessionId]/page.tsx:160`
  - `What` : `close`/`export` の `res.ok` を確認せず、失敗しても「投票を終了しました」やダウンロード実行が走る
  - `Why` : ネットワーク障害や404時にユーザーへ誤情報が出る
  - `How to fix` : `res.ok` を判定し、失敗時は `res.json()` の `error` を表示・成功時のみメッセージ更新/ダウンロードを行う

- [May] CSVエクスポートで値のエスケープがなく、CSVが壊れる
  - `Where` : `app/api/vote/[sessionId]/export/route.ts:72`
  - `What` : `choice.text` をそのまま連結しており、カンマ/改行/ダブルクォートを含むとCSVが崩れる
  - `Why` : 実データに含まれるとエクスポートの信頼性が落ちる
  - `How to fix` : `"` を `""` に置換し、`"${text}"` で囲む等のCSVエスケープを実装する

- [May] SSEの再接続が無効化されており、瞬断で更新が止まる
  - `Where` : `app/vote/[sessionId]/page.tsx:99`
  - `What` : `onerror` で即 `close()` しており自動リトライが働かない
  - `Why` : 一時的なネットワーク不調で以降の結果更新が途切れる
  - `How to fix` : `close()` を外す、もしくは指数バックオフで再接続する
