# 改善・修正タスクリスト

リポジトリ全体のコードレビューに基づき、対応すべき事項を優先度順にまとめました。

## 🚨 緊急 (High Priority)

動作に支障をきたす可能性がある、または設定として明らかに誤っている項目。

- [ ] **`package.json` の `uuid` バージョン修正**
  - **現状**: `"uuid": "^13.0.0"` と記述されている。
  - **問題**: `uuid` パッケージの最新安定版は v11 系であり、v13 は存在しない可能性が高い（または typo）。
  - **対応**: 正しいバージョン（例: `^11.0.0`）に修正し、`npm install` を再実行する。

- [ ] **`wrangler.jsonc` の `compatibility_date` 修正**
  - **現状**: `"compatibility_date": "2025-03-25"`
  - **問題**: 未来の日付になっている（現在は 2024年11月）。
  - **対応**: 本日の日付 `2024-11-23` または直近の過去の日付に修正する。

## ⚠️ 重要 (Medium Priority)

コード品質、型安全性、保守性を向上させるための項目。

- [ ] **Cloudflare Context の型定義強化**
  - **現状**: `getCloudflareContext()` が型引数なしで使用されており、`env` が `any` (または `unknown`) になっている。
  - **対応**: `getCloudflareContext<CloudflareEnv>()` のようにジェネリクスを指定し、型安全性を確保する。
  - **対象ファイル**:
    - `src/app/api/vote/route.ts`
    - `src/app/api/vote/[sessionId]/route.ts`
    - `src/app/api/vote/[sessionId]/stream/route.ts`

- [ ] **Durable Object の型定義強化**
  - **現状**: `src/lib/durable_object.ts` の `VoteSessionDO` コンストラクタで `_env: unknown` となっている。
  - **対応**: `CloudflareEnv` 型をインポートして適用する。

- [ ] **Durable Object 内のバリデーション強化**
  - **現状**: `handleInit` メソッドなどでリクエストボディのバリデーションが不十分。API Route 側でチェックしているとはいえ、DO 側でも堅牢性を高めるべき。
  - **対応**: 必須フィールドのチェックや型チェックを追加する。

## 🔧 改善 (Low Priority)

機能追加やリファクタリング、開発環境の整備。

- [ ] **テストコードの導入**
  - **現状**: テストコードが存在しない。
  - **対応**: `vitest` を導入し、Durable Object の単体テストや API の統合テストを作成する。

- [ ] **ESLint 設定の整合性確認**
  - **現状**: `eslint-config-next` が `16.0.1` だが、Next.js 本体は `15.5.6`。
  - **対応**: バージョン間の互換性を確認し、必要であれば `eslint-config-next` を `15.x` 系にダウングレードする。

- [ ] **エラーハンドリングとログ出力の強化**
  - **現状**: `console.error` のみで、構造化ログやエラー追跡が考慮されていない。
  - **対応**: ログ出力フォーマットの統一や、エラーレスポンスの共通化を検討する。
