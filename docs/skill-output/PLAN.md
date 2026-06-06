# 実装計画: Vite + Hono 開発環境

## 概要

`legacy/` に退避した旧 Next.js 実装と分離し、ルートへ React SPA と Cloudflare Worker を同居させる。Cloudflare Vite Plugin を使い、フロントエンド、Hono API、D1、Durable Object を1つの開発サーバーで動かす。

## 要件

- React + Vite + TypeScript で SPA を構成する。
- Hono + Zod で Worker API を構成する。
- D1 を Drizzle ORM / Drizzle Kit で管理する。
- Durable Object から SSE を配信できる土台を作る。
- Vitest Workers Pool と Playwright を利用できるようにする。
- `legacy/` をビルド、lint、test の対象外にする。

## アーキテクチャ変更

- `vite.config.ts`: React、Tailwind CSS、Cloudflare Vite Plugin を統合する。
- `src/client/`: React SPA、画面ルーティング、API接続を配置する。
- `src/server/`: Hono Worker、D1アクセス、APIルートを配置する。
- `src/durable-objects/`: room単位のSSE配信DOを配置する。
- `src/shared/`: APIとブラウザで共有するZod schemaと型を配置する。
- `drizzle.config.ts` / `drizzle/`: D1 migrationを管理する。

## 実装手順

### フェーズ1: プロジェクト設定

1. **Vite / Worker設定を作成する** (File: `package.json`, `vite.config.ts`, `wrangler.jsonc`)
   - Action: dev、build、preview、deploy、typegenのコマンドとCloudflare bindingsを定義する。
   - Why: フロントエンドとWorkerを同じ開発環境で動かすため。
   - Dependencies: なし
   - Risk: 中

2. **TypeScriptと品質設定を更新する** (File: `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`)
   - Action: Workers、Vite、Reactを型検査対象にし、`legacy/`を除外する。
   - Why: 新旧コードを混在させず検証するため。
   - Dependencies: ステップ1
   - Risk: 低

### フェーズ2: アプリケーション基盤

3. **React SPAを作成する** (File: `src/client/*`)
   - Action: React Router、Tailwind CSS、API health表示を実装する。
   - Why: UI開発を開始できる最小画面を用意するため。
   - Dependencies: ステップ1
   - Risk: 低

4. **Hono Workerを作成する** (File: `src/server/index.ts`)
   - Action: health API、Zod validation、DOへのSSE転送を実装する。
   - Why: APIとCloudflare bindingの動作確認を可能にするため。
   - Dependencies: ステップ1
   - Risk: 中

5. **D1 / Drizzle基盤を作成する** (File: `src/server/db/*`, `drizzle.config.ts`)
   - Action: 設計文書に沿ったテーブルschemaとmigration生成設定を作る。
   - Why: D1をSource of Truthとして実装するため。
   - Dependencies: ステップ1
   - Risk: 中

6. **Durable Object / SSE基盤を作成する** (File: `src/durable-objects/room-events.ts`)
   - Action: version付きsnapshotの保持、SSE接続、broadcastを実装する。
   - Why: リアルタイム配信を段階的に実装できるようにするため。
   - Dependencies: ステップ4
   - Risk: 中

### フェーズ3: 検証

7. **テスト環境を作成する** (File: `vitest.config.ts`, `tests/*`)
   - Action: Workers runtime上でhealth APIを検証する。
   - Why: Node.jsとの差異を含めてWorkerをテストするため。
   - Dependencies: ステップ4
   - Risk: 低

8. **ローカル起動を検証する**
   - Action: migration生成、typecheck、lint、test、build、dev serverへのHTTPアクセスを確認する。
   - Why: 開発開始可能な状態を保証するため。
   - Dependencies: ステップ3から7
   - Risk: 中

## テスト戦略

- Unit / integration: Vitest Workers PoolでHono APIとDOを検証する。
- Database: ローカルD1へmigrationを適用してschemaを確認する。
- E2E: PlaywrightでSPAとAPIの主要導線を確認する。

## リスクと対策

- **Risk**: Cloudflare bindingsが通常のVite dev serverで再現されない。
  - Mitigation: `@cloudflare/vite-plugin`を使い、Workerをworkerd上で実行する。
- **Risk**: ORMが状態遷移SQLを隠蔽する。
  - Mitigation: Drizzleの`sql`と`db.batch()`を利用し、重要な条件付き更新を明示する。
- **Risk**: legacyコードがlintや型検査へ混入する。
  - Mitigation: 各設定で`legacy/`を明示的に除外する。

## 成功基準

- [x] `pnpm dev`でSPAとAPIが同時に起動する。
- [x] `GET /api/health`がD1 bindingを確認して成功する。
- [x] Drizzle migrationを生成・ローカル適用できる。
- [x] Durable ObjectのSSE endpointへ接続できる。
- [x] `pnpm check`、`pnpm test`、`pnpm build`が成功する。
