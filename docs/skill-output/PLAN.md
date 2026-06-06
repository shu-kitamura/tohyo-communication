# 実装計画: ルーム作成と質問作成の分離

## 概要

ルーム作成時にはルーム名と管理パスワードだけを受け取り、質問を作成できない仕様へ変更する。作成後は質問0件の主催者画面へ遷移し、質問追加ダイアログから最初の質問を作成する。

## 要件

- ルーム作成画面から質問、投票形式、選択肢を削除する。
- ルーム名と管理パスワードだけを必須にする。
- 作成後は `/rooms/:roomId/host` へ遷移する。
- 主催者画面は質問0件の空状態で開始する。
- 質問は主催者画面からのみ追加する。

## アーキテクチャ変更

- `src/client/pages/create-room-page.tsx`: ルーム作成専用フォームへ簡略化する。
- `src/client/types/room.ts`: 作成後の遷移データから最初の質問を削除する。
- `src/client/pages/host-room-page.tsx`: 質問一覧を常に空状態から初期化する。
- `docs/system-design.md`: ルーム作成と質問作成を別API・別トランザクションにする。
- `tests/e2e/home.spec.ts`: 空ルーム作成フローを検証する。

## 実装手順

### フェーズ1: 作成フロー

1. **ルーム作成フォームを簡略化する** (File: `src/client/pages/create-room-page.tsx`)
   - Action: 質問関連入力を削除し、ルーム名と管理パスワードだけを残す。
   - Why: ルームと質問のライフサイクルを分離するため。
   - Dependencies: なし
   - Risk: 低

2. **遷移データを簡略化する** (File: `src/client/types/room.ts`)
   - Action: `RoomCreationNavigationState` をルーム名だけにする。
   - Why: 作成時に質問を生成しない仕様を型で保証するため。
   - Dependencies: ステップ1
   - Risk: 低

3. **主催者画面を空状態で開始する** (File: `src/client/pages/host-room-page.tsx`)
   - Action: 初期質問の受け取りを削除し、質問追加導線を表示する。
   - Why: 質問作成を主催者画面へ統一するため。
   - Dependencies: ステップ2
   - Risk: 低

### フェーズ2: 設計と検証

4. **設計書を更新する** (File: `docs/system-design.md`)
   - Action: `POST /api/rooms` から質問を除外し、質問作成APIと分離する。
   - Why: UIと将来のAPI実装を同じ責務境界に揃えるため。
   - Dependencies: ステップ1
   - Risk: 低

5. **E2Eを更新する** (File: `tests/e2e/home.spec.ts`)
   - Action: ルーム作成後に質問0件の主催者画面へ遷移することを検証する。
   - Why: 作成時に質問が暗黙作成されないことを保証するため。
   - Dependencies: ステップ3
   - Risk: 低

## テスト戦略

- 静的検査: `pnpm check`
- Workersテスト: `pnpm test`
- E2E: 必須入力、作成後遷移、質問0件の空状態
- ビルド: `pnpm build`

## リスクと対策

- **Risk**: 作成直後に質問追加が必要なことが分かりにくい。
  - Mitigation: 主催者画面の空状態に「最初の質問を追加」ボタンを表示する。
- **Risk**: API設計が旧フローのまま実装される。
  - Mitigation: 設計書で `POST /api/rooms` と質問作成APIを明確に分離する。

## 成功基準

- [x] ルーム作成画面に質問入力がない。
- [x] ルーム名と管理パスワードだけで作成できる。
- [x] 作成後の主催者画面が質問0件で表示される。
- [x] 主催者画面から最初の質問を追加できる。
- [x] `pnpm check`、`pnpm test`、`pnpm test:e2e`、`pnpm build`が成功する。
