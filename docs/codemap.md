# Code Map

## 目的

- このリポジトリの主要な入口・責務・データフローを素早く把握するための案内図。

## 主要エントリーポイント

- `worker.ts`: Cloudflare Workers のエントリーポイント。OpenNext のハンドラを公開し、Durable Object をエクスポート。
- `src/app/layout.tsx`: グローバルレイアウトとヘッダー。
- `src/app/page.tsx`: トップページ（LP）。
- `src/app/vote/page.tsx`: 投票セッション作成フォーム。
- `src/app/vote/[sessionId]/page.tsx`: 投票セッション画面（`?view=organizer` で主催者/参加者の出し分け）。

## API ルート（Next.js）

- `src/app/api/vote/route.ts`: POST でセッション作成。DO の `/init` を呼び出し。
- `src/app/api/vote/[sessionId]/route.ts`: GET でセッション取得（投票済み判定含む）。POST で投票（`voter_token` を Cookie 管理）。
- `src/app/api/vote/[sessionId]/stream/route.ts`: GET で SSE 接続（DO の `/stream` へ中継）。
- `src/app/api/vote/[sessionId]/close/route.ts`: POST で投票終了。
- `src/app/api/vote/[sessionId]/export/route.ts`: GET で CSV/JSON エクスポート（`format=image` は未実装）。

## Durable Object

- `src/lib/durable_object.ts`: セッション状態の永続化、投票集計、SSE 配信、エクスポート、24h 後のアラーム削除。

## UI コンポーネント

- `src/app/vote/[sessionId]/components/organizer-view.tsx`: 主催者ビュー（QRコード、エクスポート、終了操作）。
- `src/app/vote/[sessionId]/components/voter-view.tsx`: 参加者ビュー（投票フォーム、結果表示）。
- `src/app/vote/[sessionId]/components/result-chart.tsx`: 棒/円グラフの表示（Recharts）。
- `src/components/common/header.tsx`: 共通ヘッダー。
- `src/components/ui/*`: shadcn/ui 系のプリミティブ。

## 共有モジュール

- `src/lib/types.ts`: ドメイン/API の型定義。
- `src/lib/utils.ts`: `cn` ユーティリティ（`clsx` + `tailwind-merge`）。
- `src/lib/store.ts`: メモリ内ストア（現状未使用のレガシー）。
- `components.json`: shadcn/ui 設定。

## アセット/スタイル

- `src/app/globals.css`: Tailwind のグローバルスタイル。
- `public/tohyo-communication.svg`: ロゴ画像。
- `docs/*`: 仕様書・設計・TODO・デモ GIF。

## 設定/インフラ

- `next.config.ts`: Next.js 設定。
- `open-next.config.ts`: OpenNext（Cloudflare Workers）設定。
- `wrangler.jsonc`: Cloudflare Workers / DO 設定。
- `tsconfig.json`, `env.d.ts`, `next-env.d.ts`: TypeScript 設定。
- `eslint.config.mjs`, `postcss.config.mjs`: Lint/ビルド設定。

## 主要フロー（最短経路）

- セッション作成: `src/app/vote/page.tsx` → `src/app/api/vote/route.ts` → `src/lib/durable_object.ts:/init`
- 投票: `src/app/vote/[sessionId]/page.tsx` → `src/app/api/vote/[sessionId]/route.ts` → `src/lib/durable_object.ts:/vote`
- リアルタイム更新: `src/app/vote/[sessionId]/page.tsx` → `src/app/api/vote/[sessionId]/stream/route.ts` → `src/lib/durable_object.ts:/stream`
