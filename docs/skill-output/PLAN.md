# 実装計画: V1実装と旧構成参照の削除

## 概要

現行のCloudflare Workers + Hono + React/Vite + D1構成だけでリポジトリを理解できるようにする。旧Next.js/OpenNext実装を削除し、ドキュメントとツール設定を現行構成へ統一する。

## 要件

- `legacy/` 配下のV1実装を削除する
- `AGENTS.md` と `README.md` を現行仕様へ更新する
- Next.js/OpenNext/V1専用の設定とAI向けガイドを整理する
- `wrangler.jsonc` のDurable Object migration履歴は維持する
- 現行実装のcheck、test、E2E、buildが成功することを確認する

## アーキテクチャ変更

- `legacy/`: 旧Next.js/OpenNext実装一式を削除する
- `AGENTS.md`: React/Vite/Hono/D1/RoomEventsDO構成と現行ルート・機能へ更新する
- `README.md`: 旧実装の退避説明とディレクトリ項目を削除する
- `.gitignore`, `.oxlintrc.json`, `.oxfmtrc.json`, `tsconfig.json`: V1専用除外を削除する
- `.codex/skills/code-review/SKILL.md`: レビュー対象と観点を現行技術スタックへ更新する

## 実装手順

### フェーズ1: 旧実装と参照の整理

1. **V1実装を削除する** (File: `legacy/`)
   - Action: 旧Next.js/OpenNextのコード、設定、依存関係、テストを削除する
   - Why: 現行実装との誤認を防ぐため
   - Dependencies: なし
   - Risk: 低（削除対象が明示されている）

2. **プロジェクトガイドを更新する** (File: `AGENTS.md`, `README.md`)
   - Action: 現行のルーム、認証、D1永続化、RoomEventsDOによるSSE配信を説明する
   - Why: 開発者とAIが現行仕様だけを参照できるようにするため
   - Dependencies: 現行ドキュメントと実装の確認
   - Risk: 中（仕様記述の不一致）

3. **V1専用設定を削除する** (File: `.gitignore`, `.oxlintrc.json`, `.oxfmtrc.json`, `tsconfig.json`)
   - Action: Next.js、OpenNext、legacy向けの除外設定を削除する
   - Why: 不要な設定を残さず、検索やチェック対象を明確にするため
   - Dependencies: ステップ1
   - Risk: 低

4. **コードレビュースキルを更新する** (File: `.codex/skills/code-review/SKILL.md`)
   - Action: Next.js固有の対象・観点をReact/Vite/Hono/D1へ置き換える
   - Why: AI向けガイドが旧構成を前提にしないようにするため
   - Dependencies: なし
   - Risk: 低

### フェーズ2: 検証

1. **残存参照を検索する** (File: repository-wide)
   - Action: V1ルート、Next.js、OpenNext、legacy参照を検索し、migration履歴と生成型以外が残っていないことを確認する
   - Why: 削除漏れを防ぐため
   - Dependencies: フェーズ1
   - Risk: 低

2. **品質チェックを実行する** (File: repository-wide)
   - Action: `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm build` を実行する
   - Why: 現行実装へ影響がないことを確認するため
   - Dependencies: フェーズ1
   - Risk: 中（ブラウザやローカル環境依存）

## テスト戦略

- 静的検査: lint、format、TypeScript typecheck
- ユニット/結合テスト: Vitest Workers Poolの全テスト
- E2Eテスト: Playwrightでルーム作成・投票フロー
- ビルド: Vite + Cloudflare Worker本番ビルド
- 残存参照: `rg` による旧構成キーワード検索

## リスクと対策

- **Risk**: migration履歴の `VoteSessionDO` を誤って削除する
  - Mitigation: `wrangler.jsonc` のv1/v2 migrationは変更せず、差分と検索結果で確認する
- **Risk**: 現行機能を旧実装と誤認して削除する
  - Mitigation: `src/`, `docs/`, `tests/` の現行ルームAPIとSSE設計を基準に判定する

## 成功基準

- [x] `legacy/` が削除されている
- [x] 現行ドキュメントとAI向けガイドに旧構成の説明が残っていない
- [x] Next.js/OpenNext/V1専用設定が削除されている
- [x] `wrangler.jsonc` の `VoteSessionDO` migration履歴が維持されている
- [ ] `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm build` が成功する
