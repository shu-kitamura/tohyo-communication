# TOHYO通信

イベントやワークショップ向けのリアルタイム投票アプリケーションです。

現在、ルートディレクトリでは新アーキテクチャへの移行を進めています。旧 Next.js 実装は `legacy/` に退避してあり、公開中の https://vote.shu-kita.net は旧実装を基にしています。

## アーキテクチャ

- D1 を永続データの Source of Truth とする
- Cloudflare Workers + Hono が API、認証、入力検証、D1 操作を担当する
- Durable Objects が room 単位の snapshot cache と SSE 配信を担当する
- React SPA が Worker API と EventSource API を利用する

設計の詳細は [`docs/system-design.md`](./docs/system-design.md) と [`docs/database-design.md`](./docs/database-design.md) を参照してください。

## 技術スタック

### Frontend

- React 19
- Vite 8
- TypeScript
- React Router
- Tailwind CSS
- EventSource API

### Backend / Realtime

- Cloudflare Workers
- Hono
- Zod
- Durable Objects
- Server-Sent Events

### Database

- Cloudflare D1
- Drizzle ORM
- Drizzle Kit

### Development / Test

- pnpm
- Wrangler
- Vitest Workers Pool
- Playwright
- Oxlint / Oxfmt

## セットアップ

Node.js 22 と pnpm 10 を使用します。

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

開発サーバーは `http://localhost:5173` で起動します。

## 主なコマンド

```bash
pnpm dev                # SPA + Worker の開発サーバー
pnpm check              # lint + format + typecheck
pnpm test               # Workers runtime のテスト
pnpm test:e2e           # Playwright E2E
pnpm build              # Worker + SPA の本番ビルド
pnpm db:generate        # Drizzle migration 生成
pnpm db:migrate:local   # ローカル D1 へ migration 適用
pnpm cf-typegen         # Cloudflare binding/runtime 型生成
```

## ディレクトリ

```text
src/client/             React SPA
src/server/             Hono Worker / D1
src/durable-objects/    room 単位の SSE 配信
src/shared/             共有 schema / 型
drizzle/                D1 migration
tests/                  Vitest / Playwright
legacy/                 旧実装
```

## デプロイ前の設定

`wrangler.jsonc` の D1 `database_id` はローカル開発用のプレースホルダーです。本番 D1 を作成し、実際の ID に差し替えてから migration と deploy を実行します。
