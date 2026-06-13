# AI Agent Guidelines

## Project Overview

- TOHYO通信は、イベントやワークショップ向けのサーバーレスなリアルタイム投票アプリケーションです。
- ホストはルームを作成し、ルーム内に単一選択または複数選択の質問を追加して、受付開始・終了を操作できます。
- ゲストは共有された `/rooms/:roomId` を開き、受付中の質問へ投票できます。同じURLで、サーバーがセッションCookieを検証してホスト/ゲスト表示を切り替えます。
- 投票結果はServer-Sent Eventsでリアルタイム配信されます。ホストは全結果を確認でき、ゲストは回答済み質問の結果だけを確認できます。
- 管理パスワードとCloudflare Turnstileでルーム作成・ホスト権限を保護し、匿名セッションCookieとD1のunique制約で同一ブラウザからの重複投票を防ぎます。
- 終了済みルームと関連データは30日間保持し、日次Cronで削除します。

## Architecture

- Frontend: React 19、Vite、React Router、Tailwind CSSで構成するSPAです。
- API: Cloudflare Workers上のHonoがルーティング、Zod入力検証、認証、rate limit、D1操作を担当します。
- Persistence: Cloudflare D1を唯一のSource of Truthとし、Drizzle ORMとmigrationでschemaを管理します。
- Realtime: `RoomEventsDO` がルーム単位のSSE接続、最新snapshotのインメモリキャッシュ、broadcastを担当します。Durable Objectは投票データを永続化せず、D1へ直接アクセスしません。
- Auth: ホストセッションと匿名セッションをルーム単位のHttpOnly Cookieで管理します。ホスト専用APIは必ずサーバー側でCookieを検証します。
- Main routes: `/` はランディングページ、`/rooms/` はルーム作成、`/rooms/:roomId` はホスト/ゲスト共通入口です。
- Main API groups: `/api/rooms`, `/api/rooms/:roomId`, `/api/rooms/:roomId/questions`, `/api/rooms/:roomId/events` です。詳細は `docs/api.md` を参照してください。

## Design Philosophy

- Readability First: 可読性を最優先し、過度な抽象化や巧妙な短縮記法を避けます。
- Maintainable & Simple: 現行構成を保った小さく明示的な変更を選び、不要な依存関係や大規模な再設計を持ち込みません。
- Type Safety and Clarity: TypeScriptの厳格な型を活用し、適切なinterfaceやschemaを定義します。不要な`any`や`unknown`を避けます。
- Robustness Over Optimization: フロントエンドだけに依存せず、Workerで入力、権限、状態遷移を検証します。性能の微調整より正しさとエッジケースを優先します。
- Consistent Style: 既存の命名、ファイル構成、フォーマット、UI文言の日本語表記に合わせます。

## Scope of Changes

- Incremental Improvements: バグ修正、小規模な機能追加、型や可読性の改善を中心にします。明示的な依頼なしに大規模なアーキテクチャ変更を行いません。
- Preserve Existing Behavior: リアルタイム投票、D1上のデータ整合性、ホスト権限、重複投票防止を壊さないようにします。
- No Unnecessary Config Changes: 問題の解決に必要でない限り、`package.json`、ビルド設定、Cloudflare設定、依存関係を変更しません。
- Data Ownership: 永続データはD1に保存し、Durable Objectは再生成可能なsnapshotとSSE接続だけを保持します。
- Security Boundaries: `viewerRole` は表示用です。ホスト専用操作ではホストセッションCookieを再検証し、更新APIではsame-originと専用ヘッダーを検証します。
- Migration History: `wrangler.jsonc` のDurable Object migrationはCloudflareへ適用済みの履歴です。現在使わないclass名を含んでいても、履歴を削除・書き換えません。

## Testing Changes

- 変更後は原則として `pnpm check`、`pnpm test`、`pnpm test:e2e`、`pnpm build` を実行します。
- 投票フローに関わる変更では、ルーム作成、ホスト表示、質問追加・開始、ゲスト投票、SSE更新、質問・ルーム終了を確認します。
- D1 schemaを変更する場合はmigrationを追加し、既存migrationを編集しません。
- 自動テストで扱いにくいUIやCloudflare固有動作は、実施した手動確認と環境上の制約を明記します。

## AI Behavior Guidelines

- メンテナーとの説明、議論、ユーザー向け文言は簡潔な日本語で記述します。識別子は英語を使い、コメントは周辺コードの規約に合わせます。
- 不明確な要件や互換性リスクがある場合は、推測で大きな変更をせず確認します。
- 指定範囲外のファイル削除、ライセンス変更、重要設定の変更は行いません。
- コミットメッセージとPRタイトルは、現在形の命令形を使った簡潔な英語を基本とします。
- 最終回答では、変更内容と検証結果をMarkdownの箇条書きで簡潔にまとめます。
