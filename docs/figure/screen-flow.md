# 画面遷移図

TOHYO通信の主要画面と遷移です。`/rooms/:roomId` はホスト/ゲスト共通入口で、WorkerがホストセッションCookieを検証して表示を切り替えます。

```mermaid
flowchart TD
  home["ホーム<br/>/"]
  create["ルーム作成<br/>/rooms/"]
  roomEntry["ルーム入口<br/>/rooms/:roomId"]
  loading["ルーム判定中<br/>viewerRole取得"]
  host["ホスト画面<br/>質問追加・受付開始/終了・結果確認"]
  guest["ゲスト画面<br/>投票・回答済み結果確認"]
  hostAuth["ホスト認証<br/>管理パスワード入力"]
  notFound["Not Found<br/>*"]

  home -->|"ルームを作成"| create
  create -->|"作成成功<br/>ホストセッションCookie発行"| roomEntry
  home -->|"共有URLを開く"| roomEntry
  roomEntry --> loading

  loading -->|"viewerRole: host"| host
  loading -->|"viewerRole: guest"| guest
  loading -->|"取得失敗"| notFound

  guest -->|"投票する"| guest
  guest -->|"ホストとして開く"| hostAuth
  hostAuth -->|"認証成功<br/>ホストセッションCookie発行"| host
  hostAuth -->|"認証失敗"| guest

  host -->|"質問追加・開始・終了"| host
  host -->|"ルーム終了"| host
```

## 画面

| 画面 | ルート | 役割 |
| --- | --- | --- |
| ホーム | `/` | アプリ概要とルーム作成への導線 |
| ルーム作成 | `/rooms/` | ルーム名、管理パスワード、Turnstileを入力してルームを作成 |
| ルーム入口 | `/rooms/:roomId` | `viewerRole` を取得し、ホスト画面またはゲスト画面へ分岐 |
| ホスト画面 | `/rooms/:roomId` | 質問追加、受付開始・終了、全結果確認、ルーム終了 |
| ゲスト画面 | `/rooms/:roomId` | 受付中質問への投票、回答済み質問の結果確認、ホスト認証 |
| Not Found | `*` | 未定義ルートまたはルーム取得失敗時の表示 |

## 補足

- ホスト画面とゲスト画面は同じURLを使います。
- `viewerRole` は表示分岐用です。ホスト専用APIはサーバー側でホストセッションCookieを再検証します。
- ゲスト画面から管理パスワード認証に成功すると、同じURLのままホスト画面へ切り替わります。
