# 認証とセッション

このアプリはユーザー登録やログインを持ちません。権限と重複投票制御は、ルーム単位のCookieで扱います。

## 用語

| 用語 | 説明 |
| --- | --- |
| ホスト | 質問作成、投票開始、投票終了ができる人 |
| ゲスト | 投票に参加する人 |
| 管理パスワード | ホストセッションを取得するためのルーム別パスワード |
| ホストセッション | ホスト権限を示すHttpOnly Cookie |
| 匿名セッション | ゲストの重複投票制御用HttpOnly Cookie |

## viewerRole

`viewerRole` はバックエンドからフロントエンドへ返す表示用の値です。

```json
{
  "viewerRole": "host"
}
```

判定はサーバー側で行います。

```text
valid host session cookie -> host
otherwise                 -> guest
```

フロントエンドから `viewerRole: "host"` を送ってもホスト権限は得られません。ホスト専用APIは、必ずサーバー側でホストセッションCookieを検証します。

## ホストセッション

ホストセッションは以下のタイミングで発行します。

- ルーム作成時
- ゲスト画面で管理パスワードを入力し、検証に成功した時

発行フロー:

```text
管理パスワード入力
  -> admin_password_hash と照合
  -> random token を生成
  -> D1に token_hash を保存
  -> HttpOnly Cookie に token 生値を設定
```

Cookie名は `host_session_${roomId}` です。現在の有効期限は7日です。

ホスト権限の検証では、CookieのtokenをSHA-256でハッシュし、D1の `host_sessions.token_hash` と照合します。

## 管理パスワード

管理パスワードの生値は保存しません。D1にはPBKDF2-SHA256のハッシュ文字列だけを保存します。

保存形式:

```text
pbkdf2_sha256$iterations$salt$hash
```

現在のiteration数は `100000` です。

管理パスワードを知っている人は、新しいホストセッションを取得できます。これは複数ホストとして扱います。

## 匿名セッション

ゲストの重複投票制御に使います。Cookie名は `anonymous_session_${roomId}` です。現在の有効期限は60日です。

投票時には以下を保存します。

```text
voter_key_hash = sha256(roomId + ":" + anonymousToken)
```

匿名セッションCookieの生値はD1に保存しません。

## 重複投票制御

`votes` には `question_id` と `voter_key_hash` のunique制約があります。

```text
同じブラウザ + 同じルーム + 同じ質問
  -> 1回だけ投票可能
```

Cookie削除、別ブラウザ、別端末による再投票は防げません。匿名投票の仕様として許容しています。

## 濫用対策

- 管理パスワード照合は `roomId + 接続元IP` 単位で10回/分に制限する
- ホスト更新操作は `roomId + 接続元IP` 単位で60回/分に制限する
- 投票、参照、SSEは共有Wi-Fiの参加者をまとめて制限しないよう、匿名セッションを優先して識別する
- ルーム作成は接続元IP単位の制限に加えてTurnstileを検証する

制限超過時は `429 rate_limited` を返します。Rate Limiting bindingの障害時は既存イベントの利用を止めないためfail-openとし、Turnstile検証サービスの障害時だけルーム作成を `503` で停止します。

## Cookie方針

どちらのCookieも以下の方針です。

- `HttpOnly`
- `SameSite=Lax`
- `Secure` はHTTPS時に有効
- `Path=/`

フロントエンドJavaScriptからCookieを読む必要はありません。ブラウザがAPIリクエストへ自動送信し、Workerが検証します。

Cookieを伴う更新操作では、Cookie属性だけに依存せず、Workerが以下も検証します。

- `Origin` がリクエスト先Originと完全一致する
- `Sec-Fetch-Site: same-origin`
- フロントエンドが付与する `X-TOHYO-Request: 1`

## 未実装

- ホストセッションのログアウト
- ホストセッションの一覧表示
- ホストセッションの強制失効
- 管理パスワード変更
