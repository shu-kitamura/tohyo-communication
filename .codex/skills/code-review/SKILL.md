---
name: code-review
description: Review TypeScript/React/Vite/Hono/Cloudflare Workers/D1/Durable Objects code and write a Japanese report.
---

## TL;DR

- 役割: **Senior Web Developer** (TypeScript/React/Cloudflare Workers) として厳しめにレビューする
- 目的: ソースコードをレビューし、日本語のレポートを作成する
- レビュー対象: `src/client`, `src/server`, `src/durable-objects`, `src/shared`, `tests`, `vite.config.ts`, `wrangler.jsonc` などのTS/TSX/設定ファイルを対象にする
- レビュー観点: 正しさ/安全性/互換性/型安全/React SPA + Workers + D1特有の落とし穴を重視する
- 差分がある場合: 変更箇所を優先し、影響範囲の周辺コードも確認する
- レビュー結果: `docs/skill-output/REVIEW.md` に記載する

## Point of review

- 正しさ/挙動
  - API/Workerの入力バリデーションとエラーハンドリングが妥当かを確認する
  - ルーム/質問/投票/SSEの状態遷移が仕様(`README.md`, `docs/`)に沿うかを確認する
  - `fetch`/SSEのライフサイクルやクリーンアップが適切かを確認する
- React / Vite
  - コンポーネントのstate、effect、イベント処理が適切かを確認する
  - `useEffect`の依存配列、副作用の重複、非同期処理の競合がないかを確認する
  - React Routerのルート、遷移、URLパラメーター処理が正しいかを確認する
  - Viteのclient/Worker境界や環境変数の扱いが安全かを確認する
- Cloudflare Workers / D1 / Durable Objects
  - Honoのルーティング、middleware、Zod validationが適切かを確認する
  - D1のtransaction、制約、migration、Drizzle schemaがデータ整合性を保つかを確認する
  - D1が永続データのSource of Truthであり、DOがSSE接続と再生成可能なsnapshotだけを扱っているかを確認する
  - Edge環境の制約、SSE stream管理、`Content-Type`、`Cache-Control`が適切かを確認する
- セキュリティ/堅牢性
  - XSS/入力汚染/CORS/CSRF/Cookie属性/rate limit/Turnstileなどの対策が妥当かを確認する
  - ホスト専用APIが表示用の`viewerRole`ではなく、サーバー側のセッション検証で保護されているかを確認する
  - エラーメッセージが内部情報を過度に漏らしていないかを確認する
- 型安全/可読性
  - `any`の回避、型の整合性、null/undefinedハンドリングを確認する
  - 命名、責務分離、ネストの深さ、コメントの必要性を確認する
- テスト
  - 重要フロー(ルーム作成/質問作成・開始/投票/質問・ルーム終了/SSE)が検証されているかを確認する
  - テストがない場合は、最小限の手動確認手順を提案する

## Output format

- レビュー結果は `docs/skill-output/REVIEW.md` に日本語で記載する。ファイルが存在しない場合は新しく作成する。
- レビューの指摘は以下の形式で、重要度順に記載する。
  ```
  - [重要度] 問題点(1行要約)
    - `Where` : `path/to/file.ts:line` または `関数/コンポーネント名`
    - `What` : 何が問題か（事実）
    - `Why` : なぜ問題か（根拠）
    - `How to fix` : どう直すか(改善方針・コード例など)
  ```
- 重要度を以下の3段階で分類する。
  - `Must`: バグ/セキュリティ/重大な仕様逸脱に該当する項目
  - `Should`: 影響が大きい改善や将来の不具合予防に該当する項目
  - `May`: 品質/保守性向上の軽微な改善に該当する項目
- 指摘がない場合は「指摘なし」と明記し、残るリスクやテストギャップを短く書く
