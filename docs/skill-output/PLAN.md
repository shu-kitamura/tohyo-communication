# 実装計画: バックエンドAPIのテスト実装

## 概要
docs/test-spec.md のケースに対応するJestテストを追加する。  
Next.js App Routerのroute handlerとDurable Objectの動作を、最小限のモックで検証できる構成にする。

## 要件
- /api/vote 系APIの正常/異常ステータスを確認する
- 異常系はメッセージを検証しない
- SSEの初回/更新/終了イベントを確認する

## アーキテクチャ変更
- jest.config.ts: TypeScriptテスト実行設定（ts-jest、alias、setup）
- tests/mocks/next-server.ts: NextResponseの最小スタブ
- tests/api/*.test.ts: APIのテスト追加
- tests/do/*.test.ts: Durable ObjectのSSEテスト追加
- tests/setup/jest.setup.ts: 共通ユーティリティ（必要最小限）

## 実装手順

### フェーズ1: テスト実行基盤
1. **Jest設定の拡張** (File: jest.config.ts)
   - Action: ts-jestのtransform、@/のmoduleNameMapper、node環境の指定、setupファイル登録
   - Why: TypeScriptのroute handlerを直接テスト可能にする
   - Dependencies: なし
   - Risk: 中（Next.js依存のimport解決）

2. **NextResponseスタブの追加** (File: tests/mocks/next-server.ts)
   - Action: NextResponse.json と cookies.set を最小実装
   - Why: ルートハンドラがNextResponse依存のため
   - Dependencies: ステップ1
   - Risk: 低

### フェーズ2: APIテストの実装
3. **セッション作成APIのテスト** (File: tests/api/vote-init.test.ts)
   - Action: 正常/異常入力のステータス検証
   - Why: 入力バリデーションの担保
   - Dependencies: フェーズ1
   - Risk: 低

4. **セッション取得・投票APIのテスト** (File: tests/api/vote-session.test.ts)
   - Action: GET/POSTの主要ケース、Cookie設定の確認
   - Why: 投票フローの中核APIの安定化
   - Dependencies: フェーズ1
   - Risk: 中（cookiesモック）

5. **終了・エクスポートAPIのテスト** (File: tests/api/vote-close.test.ts, tests/api/vote-export.test.ts)
   - Action: ステータスと出力形式の確認
   - Why: 運用時の管理APIの担保
   - Dependencies: フェーズ1
   - Risk: 低

### フェーズ3: SSEの検証
6. **Durable ObjectのSSEテスト** (File: tests/do/vote-session-do.test.ts)
   - Action: init/update/closedイベント配信の確認
   - Why: 仕様のリアルタイム更新保証
   - Dependencies: フェーズ1
   - Risk: 中（ReadableStreamの読み取り）

## テスト戦略
- ユニットテスト: app/api/vote/route.ts, app/api/vote/[sessionId]/*.ts
- 結合テスト: lib/durable_object.ts のSSEフロー
- E2Eテスト: 既存のPlaywrightは今回は変更しない

## リスクと対策
- **Risk**: Next.js依存モジュールのインポート失敗  
  - Mitigation: next/server をスタブ化し、実行時依存を排除する
- **Risk**: Stream読み取りの不安定さ  
  - Mitigation: initイベントを捨てるヘルパーを用意し、順序依存を避ける

## 成功基準
- [ ] docs/test-spec.md のAPIケースがJestで実行可能
- [ ] 異常系のテストがメッセージを検証しない
- [ ] SSEのinit/update/closedイベントが検証できる
