# インターネット公開前レビュー

## 結論

2026年6月9日時点で、確認済みの `Must` はすべて対応済みです。

- JSON APIの16KB本文制限とContent-Type検証
- Cookie認証を含む更新APIの同一Origin検証
- 新規公開ルームIDの128bit化
- 公開APIのrate limitとルーム作成時のbot対策

## 指摘

- [対応済み] 公開APIのrate limitとbot対策
  - `Where` : `wrangler.jsonc`, `src/server/security.ts`, `src/server/turnstile.ts`, `src/server/index.ts`
  - `What` : 用途別のWorkers Rate Limiting bindingを追加し、超過時は `429` と `Retry-After: 60` を返します。投票とSSEは匿名セッションを優先して識別し、ルーム作成はTurnstileのtoken、action、hostnameを検証します。

- [対応済み] JSON本文を解析する前のサイズ制限
  - `Where` : `src/server/security.ts`, `src/server/index.ts`
  - `What` : JSON APIへ16KBの `bodyLimit` を適用し、超過時は `413` を返します。`Content-Type: application/json` 以外は `415` で拒否します。

- [対応済み] Cookie認証を使う更新APIのOrigin検証
  - `Where` : `src/server/security.ts`, `src/client/api.ts`
  - `What` : 全unsafe methodでOrigin完全一致、`Sec-Fetch-Site: same-origin`、`X-TOHYO-Request: 1` を必須にし、不一致は `403` で拒否します。

- [対応済み] 公開ルームIDの推測・衝突耐性
  - `Where` : `src/server/index.ts`
  - `What` : 新規ルームは完全なUUID形式に変更しました。旧 `room-xxxxxxxx` 形式も参照可能です。

- [Should] 認証情報の手動失効手段がなく、漏えい時に止められない
  - `Where` : `docs/database-design.md:102`, `docs/auth-and-sessions.md:103`, `TODO.md:27`
  - `What` : ルーム終了と終了後30日の自動削除は実装済みですが、ログアウト、全ホストセッション失効、管理パスワード変更が未実装です。
  - `Why` : 管理パスワードやホストセッションが漏れた場合に、ルームを終了せず認証情報だけを無効化できません。
  - `How to fix` : 現在の端末のログアウトと全セッション失効を追加してください。管理パスワード変更時は既存セッションを全失効する方針が単純です。

- [Should] 管理パスワードのwork factorが現在の推奨値より低い
  - `Where` : `src/server/auth.ts:6`, `docs/auth-and-sessions.md:65`
  - `What` : PBKDF2-HMAC-SHA256相当のiteration数が100,000です。
  - `Why` : OWASPの現行目安は600,000回です。また最小8文字だけでは、利用者が弱いパスワードを設定しやすい状態です。
  - `How to fix` : WorkersのCPU制限内に収まることを本番相当環境で計測し、可能な範囲でwork factorを上げてください。保存形式にiteration数が入っているため段階移行できます。文字数は12文字以上を推奨し、rate limitを先に実装してください。

- [Should] セキュリティレスポンスヘッダーが未設定
  - `Where` : `src/server/index.ts:28`, `public/` 配下
  - `What` : APIにHonoのsecure headers middlewareがなく、静的アセット用の `public/_headers` もありません。
  - `Why` : CSP、`frame-ancestors`、`X-Content-Type-Options`、`Referrer-Policy` などがなく、XSSやclickjackingへの多層防御が不足します。2026年6月9日時点の旧公開サイト応答でもこれらのヘッダーは確認できませんでした。
  - `How to fix` : APIレスポンスにはHono middleware、静的アセットには `_headers` を使用します。CSPはまずReport-Onlyで確認し、その後 `default-src 'self'` を基準に強制してください。APIには `Cache-Control: no-store` も付けます。

- [Should] 参加者向けSSEが投票数に比例してD1再取得を増幅する
  - `Where` : `src/durable-objects/room-events.ts:119`, `src/client/pages/room-page.tsx:77`, `src/server/rooms.ts:111`
  - `What` : DOは参加者ごとの回答済み質問を知らないため、SSEでは結果を全て除外します。回答済み参加者はSSEイベントを受けるたびに `GET /api/rooms/:roomId` を再実行しています。
  - `Why` : 1票ごとに回答済み参加者全員がD1のsnapshotを再取得するため、参加者数と投票数が増えるとD1 readが二次的に増えます。
  - `How to fix` : SSE接続時に回答済み質問IDをDOへ渡し、DO内で参加者別に結果をfilterできる設計にします。投票後はSSEを再接続して可視範囲を更新する方法が比較的単純です。

- [Should] 本番データ運用と障害対応の手順が未確定
  - `Where` : `wrangler.jsonc:11`, `wrangler.jsonc:28`, `README.md` の「デプロイ前の設定」
  - `What` : D1 IDはplaceholderで、本番・ステージングの分離、migration順序、復旧手順、アラート条件が文書化されていません。Observabilityはログのみ有効で、構造化イベントや通知先は未設定です。
  - `Why` : 公開後の障害で、誤migrationやD1/DOエラーを検知・復旧する基準がありません。
  - `How to fix` : 本番と検証用D1を分離し、`migrate -> smoke test -> deploy` の手順、D1 Time Travelによる復旧手順、5xx・429・DO通知失敗のアラートを決めてください。ログへパスワード、Cookie、tokenを出さない規約も必要です。

- [対応済み] データ利用・保持期間の公開説明
  - `Where` : `src/client/pages/home-page.tsx`
  - `What` : トップページに、Cookieの用途、Cloudflare上へ保存するデータ、終了後30日の保持期間、個人情報や機微情報を入力しない注意事項を表示します。
  - `Remaining` : 公開サービスとして問い合わせ先を掲載する場合は、運営者が継続して確認できる連絡手段を別途決めてください。

## 確認結果

- `pnpm check`: 成功
- `pnpm test`: 6 files / 14 tests 成功
- `pnpm test:e2e`: 4 tests 成功
- `pnpm build`: 成功
- `pnpm audit --prod`: 既知の脆弱性なし

本文上限、Content-Type、Origin、Fetch Metadata、専用ヘッダー、新しいID形式、rate limit応答、Turnstile検証はWorkerテストで検証しています。セッション失効と復旧手順は未検証です。

## 参考資料

- [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare Workers Static Assets headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Hono Body Limit middleware](https://hono.dev/docs/middleware/builtin/body-limit)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
