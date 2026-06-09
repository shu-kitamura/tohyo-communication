# 実装計画: ホスト/ゲスト判別の統一ルート化

## 概要

`/rooms/:roomId`を共通入口にして、ホストセッションCookieでホスト/ゲストを判別する構成へ移行する。ゲストは同じルーム画面から管理パスワードを入力してホストへ昇格できるようにする。

## 要件

- `/rooms/:roomId`でホスト/ゲストを自動判別する。
- ゲスト画面から管理パスワードでホストセッションを作成できる。
- API権限は引き続きホストセッションCookieで判定する。
- 投票データや匿名投票セッションの扱いは変えない。

## アーキテクチャ変更

- `src/server/auth.ts`: 保存済み管理パスワードハッシュを検証する関数を追加する。
- `src/server/index.ts`: viewer判定APIとホストセッション作成APIを追加し、作成後URLを共通ルートにする。
- `src/client/app.tsx`: `/rooms/:roomId`を統一入口コンポーネントへ変更する。
- `src/client/pages/room-entry-page.tsx`: viewer判定結果に応じてホスト/ゲスト画面を出し分ける。
- `src/client/pages/room-page.tsx`: ゲスト画面にホスト切り替えフォームを追加する。
- `tests/e2e/*.spec.ts`: URL期待値と昇格導線を更新する。

## 実装手順

### フェーズ1: API追加

1. **管理パスワード検証を追加する** (File: `src/server/auth.ts`)
   - Action: `verifyAdminPassword`を追加し、PBKDF2ハッシュを安全に比較する。
   - Why: ゲストが管理パスワードでホストセッションを作成するため。
   - Dependencies: なし
   - Risk: 中

2. **viewer/host-session APIを追加する** (File: `src/server/index.ts`)
   - Action: `GET /api/rooms/:roomId/viewer`と`POST /api/rooms/:roomId/host-session`を追加する。
   - Why: 共通ルートでの出し分けとホスト昇格に必要なため。
   - Dependencies: ステップ1
   - Risk: 中

### フェーズ2: UI統合

1. **共通ルート入口を追加する** (File: `src/client/pages/room-entry-page.tsx`)
   - Action: viewer APIを呼び、hostなら`HostRoomPage`、guestなら`RoomPage`を描画する。
   - Why: URLではなくセッションで画面を切り替えるため。
   - Dependencies: フェーズ1
   - Risk: 中

2. **ゲストからホストへ切り替えるUIを追加する** (File: `src/client/pages/room-page.tsx`)
   - Action: 管理パスワード入力フォームを追加し、成功時に共通入口へhost状態を伝える。
   - Why: ゲストが同じURLからホストへ昇格できるようにするため。
   - Dependencies: ステップ1
   - Risk: 中

## テスト戦略

- ユニット/Workerテスト: ホストセッション作成APIとパスワード不一致を確認する。
- E2Eテスト: ルーム作成後に`/rooms/:roomId`でホスト表示になること、ゲストが同URLからホストへ昇格できることを確認する。
- 静的検査: `pnpm check`
- 回帰テスト: `pnpm test`
- ブラウザテスト: `pnpm test:e2e`
- ビルド: `pnpm build`

## リスクと対策

- **Risk**: ホストCookieを持つユーザーが匿名ゲストとして扱われる。
  - Mitigation: 共通入口で最初にviewer APIを呼び、hostならゲストAPIを呼ばない。
- **Risk**: 管理パスワード検証の実装不備。
  - Mitigation: 既存ハッシュ形式を解析して同じPBKDF2条件で再計算し、長さ差込みで比較する。

## 成功基準

- [x] `/rooms/:roomId`でホスト/ゲストを判別できる。
- [x] ゲストが管理パスワードでホストへ切り替えられる。
- [x] `pnpm check`、`pnpm test`、`pnpm test:e2e`、`pnpm build`が成功する。
