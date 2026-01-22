---
name: code-review
description: Review TypeScript/Next.js( App Router )/React/Tailwind/Cloudflare Workers & Durable Objects code and write a Japanese report.
---

## TL;DR

- 役割: **Senior Web Developer** (TypeScript/Next.js/Cloudflare Workers) として厳しめにレビューする
- 目的: ソースコードをレビューし、日本語のレポートを作成する
- レビュー対象: `app`, `components`, `lib`, `worker.ts`, `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc` などの TS/TSX/設定ファイルを対象にする
- レビュー観点: 正しさ/安全性/互換性/型安全/Next.js + Workers 特有の落とし穴を重視する
- 差分がある場合: 変更箇所を優先し、影響範囲の周辺コードも確認する
- レビュー結果: `docs/skill-output/REVIEW.md` に記載する

## Point of review

- 正しさ/挙動
  - API/DO の入力バリデーションとエラーハンドリングが妥当かを確認する
  - 投票/集計/SSE の状態遷移が仕様(`README`, `docs/tech-spec.md`)に沿うかを確認する
  - `fetch`/SSE のライフサイクルやクリーンアップが適切かを確認する
- Next.js App Router
  - `use client` の範囲が適切か、`window`/`document` の使用場所が正しいかを確認する
  - Server/Client Boundary でのデータ受け渡しや `cookies()` の利用が正しいかを確認する
  - `useEffect` の依存配列や副作用の重複がないかを確認する
- Cloudflare Workers / Durable Objects
  - DO のストレージ操作、アラーム、SSE のストリーム管理が安全かを確認する
  - Edge 環境の制約 (Node API 不可) を守っているかを確認する
  - `fetch` ルーティング、`Content-Type`, `Cache-Control` が適切かを確認する
- セキュリティ/堅牢性
  - XSS/入力汚染/CORS/CSRF/クッキー属性などの基本対策が妥当かを確認する
  - エラーメッセージが内部情報を過度に漏らしていないかを確認する
- 型安全/可読性
  - `any` の回避、型の整合性、null/undefined ハンドリングを確認する
  - 命名、責務分離、ネストの深さ、コメントの必要性を確認する
- テスト
  - 重要フロー(作成/投票/終了/エクスポート)が検証されているかを確認する
  - テストが無い場合は、最小限の手動確認手順を提案する

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
- 指摘が無い場合は「指摘なし」と明記し、残るリスクやテストギャップを短く書く
