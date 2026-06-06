# 投票アプリ システム設計

## 目的

匿名で使える投票アプリを Cloudflare 上に構築する。ユーザー登録やログインは作らず、主催者はルームごとの管理パスワードで主催者セッションを取得して操作する。参加者はルーム URL にアクセスして投票する。

投票や質問の更新が発生したら、主催者と参加者のブラウザへリアルタイムに近い形で更新通知を送る。

## 採用する Cloudflare 構成

| 役割 | 採用技術 | 用途 |
| --- | --- | --- |
| ランタイム | Cloudflare Workers | 画面配信、REST API、D1 操作、SSE endpoint |
| データベース | Cloudflare D1 | rooms / host_sessions / questions / options / votes / vote_choices の永続化 |
| リアルタイム配信ハブ | Durable Objects | room_id ごとの表示用スナップショット、SSE 接続管理、broadcast |
| ブラウザ通知 | Server-Sent Events | サーバーからブラウザへの片方向更新通知 |

Workers は基本的に 1 つで構成する。投票作成用、投票更新用のように Worker を分けるのではなく、1 つの Worker の中で API ルートを分ける。

```text
1 Cloudflare Worker
  ├─ REST API
  ├─ SSE endpoint
  ├─ D1 binding
  └─ Durable Object binding

1 D1 database
  └─ 投票データの永続化

1 Durable Object class
  └─ room_id ごとのスナップショットキャッシュ + SSE 配信ハブ
```

## 全体アーキテクチャ

```text
Browser
  ├─ 画面表示
  ├─ REST API 呼び出し
  └─ SSE 接続

Cloudflare Worker
  ├─ 静的画面またはフロントエンド assets の配信
  ├─ API routing
  ├─ D1 読み書き
  ├─ anonymous session Cookie の発行
  ├─ 管理パスワードの検証
  ├─ host session token の発行と検証
  └─ Durable Object への通知

Cloudflare D1
  └─ 正式なデータ保存場所

RoomEvents Durable Object
  ├─ room_id ごとに 1 インスタンス
  ├─ 最新の表示用スナップショットを保持
  ├─ SSE 接続中のブラウザを保持
  └─ room 内の主催者・参加者へイベントを broadcast
```

## データの責務

D1 を唯一の Source of Truth として扱う。Durable Object は D1 から作成した最新の表示用スナップショットを保持し、SSE で接続中のブラウザへ配信する。

DO の状態はキャッシュであり、消えても D1 から復元できるようにする。DO から D1 へ直接アクセスせず、D1 の読み書きとスナップショット生成は Worker が担当する。

```text
D1:
  rooms, host_sessions, questions, options, votes, vote_choices
  集計結果の元データ
  ルーム状態
  room 単位の state_version
  管理パスワードハッシュ
  主催者セッショントークンハッシュ
  投票者重複排除用ハッシュ

Durable Object:
  room_id ごとの接続一覧
  最新の表示用スナップショット
  適用済み stateVersion
  SSE broadcast

Browser:
  anonymous session Cookie
  host session Cookie
  画面表示用 state
  最後に受信した stateVersion
```

DO に保持するスナップショットはインメモリキャッシュを基本とする。DO ストレージへ投票データを二重保存しない。

## スナップショットと version 管理

D1 の表示状態を変更する処理では、room 単位の `state_version` を同じトランザクション内で1増やす。

```text
質問作成
質問開始
投票
質問終了
ルーム終了
  ↓
D1 のデータ更新 + rooms.state_version の更新
```

Worker は D1 の更新トランザクション内で、更新後の `state_version` と表示用スナップショットを取得する。その後、DO に絶対値のスナップショットを渡す。

```ts
type RoomSnapshot = {
  roomId: string;
  stateVersion: number;
  roomStatus: "open" | "closed";
  currentQuestion?: {
    id: string;
    title: string;
    status: "draft" | "active" | "closed";
    questionType: "single" | "multiple";
    minChoices: number;
    maxChoices: number;
    options: Array<{
      id: string;
      label: string;
      sortOrder: number;
    }>;
  };
  results?: {
    questionId: string;
    voterCount: number;
    counts: Record<string, number>;
  };
};
```

DO は保持中の version より新しいスナップショットだけを適用する。

```text
incoming.stateVersion <= current.stateVersion
  -> 再送または古い通知として無視

incoming.stateVersion > current.stateVersion
  -> キャッシュを置き換えて SSE 配信
```

票数の差分だけを DO に渡して加算しない。絶対値を渡すことで、再送や通知順序の逆転があっても集計結果を壊さない。

命名は、D1 のカラムでは `state_version`、TypeScript 型と JSON payload では `stateVersion` に統一する。

## ルーム作成フロー

```text
主催者ブラウザ
  -> POST /api/rooms
     title, admin_password, questions, options

Worker
  -> room_id を生成
  -> admin_password_hash を作成
  -> D1 transaction で rooms / questions / options を保存
  -> 初回用 host_session_token を生成
  -> host_sessions に token_hash を保存
  -> host session Cookie を Set-Cookie

Worker
  <- room_id, host_url, participant_url を返す

主催者ブラウザ
  -> /rooms/:roomId/host
  -> /api/rooms/:roomId/events に SSE 接続
```

`admin_password` の生値は DB に保存しない。D1 には `admin_password_hash` だけ保存する。

主催者セッションは管理パスワードの検証に成功したときに発行する。`host_session_token` の生値は DB に保存せず、D1 には `host_sessions.token_hash` だけ保存する。

ルーム作成時に DO を事前作成する必要はない。最初の SSE 接続または最初の状態更新時に、`room_id` から同じ DO を取得する。

## 参加者入室フロー

```text
参加者ブラウザ
  -> GET /rooms/:roomId

Worker
  -> room の存在と公開状態を確認
  -> anonymous session Cookie がなければ発行
  -> 画面を返す

参加者ブラウザ
  -> GET /api/rooms/:roomId
  -> GET /api/rooms/:roomId/events に SSE 接続
```

ユーザー登録やログインは作らない。参加者 URL は token なしでアクセスできる。

## 匿名セッションと重複排除

重複排除は Cookie ベースの匿名セッションで行う。IP アドレスは使わない。

```text
保存しない:
  IP address
  user agent
  ログインユーザー情報
  個人情報
```

初回アクセス時に匿名セッション ID を発行し、HttpOnly Cookie に保存する。

```text
anonymous_session_id = random token
```

投票時は、Worker 側で以下のような値を作る。

```text
voter_key_hash = HMAC_SHA256(server_secret, room_id + ":" + anonymous_session_id)
```

D1 には `anonymous_session_id` の生値を保存しない。保存するのは `voter_key_hash` のみ。

案Cを正式採用するため、`votes.voter_key_hash` は必須にするのが望ましい。

```text
votes.voter_key_hash text NOT NULL
```

同一質問への重複投票は DB のユニーク制約で防ぐ。

```sql
CREATE UNIQUE INDEX uq_votes_one_per_voter_per_question
  ON votes (question_id, voter_key_hash);
```

この方式で防げるのは「同じブラウザ・同じルーム内での重複投票」。Cookie を削除する、別ブラウザを使う、別端末を使う、といった再投票は防げない。匿名投票としてこの制約は仕様として受け入れる。

### Cookie 方針

```text
HttpOnly
Secure
SameSite=Lax
Path=/rooms/:roomId または /
Max-Age=60日程度
```

フロントエンド JavaScript から Cookie を読む必要はない。投票 API にブラウザが Cookie を自動送信し、Worker が処理する。

## 投票フロー

```text
参加者ブラウザ
  -> POST /api/questions/:questionId/votes

Worker
  -> Cookie から anonymous_session_id を取得
  -> voter_key_hash を作成
  -> D1 transaction 内で以下を実行
     -> room が open か確認
     -> question が active か確認
     -> option が対象 question に属しているか確認
     -> 選択数が min_choices / max_choices を満たすか確認
     -> votes / vote_choices を INSERT
     -> rooms.state_version を1増やす
     -> 更新後の results と state_version を取得
  -> UNIQUE 違反なら 409 Conflict

Worker
  -> room_id の RoomEvents Durable Object に
     snapshot + stateVersion を通知

RoomEvents Durable Object
  -> 新しい stateVersion の場合だけキャッシュを置き換える
  -> SSE 接続中の主催者・参加者へ snapshot を broadcast
```

更新1回につき Worker が D1 からスナップショットを1回作り、DO が接続者全員へ配信する。接続者ごとの結果再取得は行わない。

```text
参加者100人
投票1回
  -> D1 更新・集計 1回
  -> Worker から DO へ通知 1回
  -> DO から100人へ SSE 配信
```

集計は D1 の更新トランザクション内で確定させる。コミット後に別の SELECT を行うと、後続更新を含む結果と古い `state_version` を組み合わせる可能性があるため避ける。

## SSE 設計

SSE endpoint は Worker で受け、room_id に対応する Durable Object へ転送する。

```text
GET /api/rooms/:roomId/events
```

接続フロー:

```text
Browser
  -> GET /api/rooms/:roomId/events

Worker
  -> room の存在を確認
  -> D1 から最新 snapshot + state_version を取得
  -> env.ROOM_EVENTS.idFromName(roomId) で Durable Object ID を取得
  -> snapshot と接続者種別を付けて Durable Object に request を渡す

RoomEvents Durable Object
  -> Worker から渡された snapshot が新しければキャッシュを更新
  -> SSE stream を返す
  -> 接続を保持
  -> 接続直後に現在の snapshot を送信
```

SSE 接続ごとに D1 を1回読むが、更新イベントごとに接続者全員が D1 を読むことは避けられる。DO が再起動してインメモリ状態を失った場合も、次の接続時に D1 から復元される。

通知フロー:

```text
Worker
  -> D1 更新後の snapshot + state_version を
     stateVersion に変換して Durable Object に POST /snapshot

RoomEvents Durable Object
  -> 古い version を無視
  -> キャッシュを置き換える
  -> 接続中の SSE clients に snapshot を送信
```

イベント例:

```text
id: 42
event: room.snapshot
data: {
  "roomId": "room_xxx",
  "stateVersion": 42,
  "roomStatus": "open",
  "currentQuestion": {
    "id": "question_xxx",
    "title": "好きなクラウドは？",
    "status": "active",
    "questionType": "single",
    "minChoices": 1,
    "maxChoices": 1,
    "options": [
      {"id": "option_1", "label": "AWS", "sortOrder": 1},
      {"id": "option_2", "label": "Azure", "sortOrder": 2}
    ]
  },
  "results": {
    "questionId": "question_xxx",
    "voterCount": 15,
    "counts": {
      "option_1": 10,
      "option_2": 5
    }
  }
}
```

基本イベント:

```text
room.snapshot
```

質問作成、投票開始、投票、質問終了、ルーム終了は、すべて `room.snapshot` の内容で表現する。必要になった場合だけ、操作完了通知などの個別イベントを追加する。

### 主催者向けと参加者向けの配信

Worker は SSE 接続時に Cookie から主催者セッションを検証し、DO に接続者種別を渡す。ブラウザから任意の種別を指定させない。

```text
host:
  currentQuestion
  active 中を含む results

participant:
  currentQuestion
  公開設定で許可された場合だけ results
```

参加者に投票中結果を見せない場合、DO は参加者向け payload から `results` を除外する。画面で隠すだけではなく、SSE payload 自体に含めない。

### 通知失敗と再接続

D1 更新と DO 通知は単一トランザクションにできない。D1 更新成功後に DO 通知が失敗しても、D1 の更新は成功として扱う。

```text
D1 更新成功
  -> DO 通知を短時間で再試行
  -> 失敗した場合はログへ記録
  -> 次回の更新通知、SSE 再接続、画面再表示で最新 snapshot に復旧
```

DO 通知失敗中は既存接続の表示が一時的に古くなる可能性がある。通知の確実な配信が必要になった場合は、D1 outbox または Cloudflare Queues の導入を別途検討する。

EventSource の自動再接続時は、Worker が D1 から最新スナップショットを取得して DO に渡す。DO は `stateVersion` を比較してから接続直後のスナップショットを返すため、取り逃したイベントを個別に再生しなくても最新状態へ復旧できる。

SSE 接続には定期的な heartbeat を送り、切断済み client は write 失敗または request abort を検知して接続一覧から削除する。

## 主催者操作

主催者専用操作は、ルームごとの管理パスワードから発行される `host_session_token` で守る。ユーザー認証は作らない。

```text
主催者 URL:
  /rooms/:roomId/host

参加者 URL:
  /rooms/:roomId
```

主催者画面にアクセスしたとき、host session Cookie がなければ管理パスワード入力を求める。

```text
主催者ブラウザ
  -> POST /api/rooms/:roomId/host-sessions
     admin_password

Worker
  -> rooms.admin_password_hash と照合
  -> 正しければ host_session_token を生成
  -> host_sessions に token_hash を保存
  -> host session Cookie を Set-Cookie

主催者ブラウザ
  -> 主催者操作 API を呼び出せる
```

主催者操作 API では `host_session_token` を Cookie から受け取り、D1 の `host_sessions.token_hash` と照合する。

```text
POST  /api/rooms
POST  /api/rooms/:roomId/host-sessions
DELETE /api/rooms/:roomId/host-session
POST  /api/rooms/:roomId/questions
PATCH /api/questions/:questionId/activate
PATCH /api/questions/:questionId/close
PATCH /api/rooms/:roomId/close
```

管理パスワードを知っている人は誰でも主催者セッションを取得できる。これは乗っ取りリスクではあるが、同時に複数ホスト機能として扱う。

管理パスワードを失うと、そのルームの主催者権限は復旧できない。メール認証やユーザーアカウントを作らないため、パスワードリセット機能も作らない。

管理パスワードの総当たりを避けるため、最低文字数を設ける。`admin_password_hash` には、ハッシュ方式、salt、パラメータ、hash を含めた文字列を保存する。実装時は Argon2id などのパスワードハッシュを優先し、Workers 標準 API だけで始める場合は PBKDF2-HMAC-SHA-256 を使う。

IP address は保存しないため、ログイン試行制限を入れる場合は room 単位の短期 throttling にする。

## API 一覧

```text
GET  /rooms/:roomId
GET  /rooms/:roomId/host

POST /api/rooms
GET  /api/rooms/:roomId
POST /api/rooms/:roomId/host-sessions
DELETE /api/rooms/:roomId/host-session
PATCH /api/rooms/:roomId/close

POST /api/rooms/:roomId/questions
PATCH /api/questions/:questionId/activate
PATCH /api/questions/:questionId/close

POST /api/questions/:questionId/votes
GET  /api/questions/:questionId/results

GET  /api/rooms/:roomId/events
```

## 画面更新の考え方

ブラウザは初回表示用 API から参加者固有の状態を取得し、共有される room 状態は SSE のスナップショットで更新する。

```text
初回表示:
  GET /api/rooms/:roomId
  SSE 接続開始
  room.snapshot を受信

SSE 受信:
  stateVersion が現在値より新しい
    -> 画面 state を snapshot で置き換える
  stateVersion が現在値以下
    -> 無視する

SSE 再接続:
  Worker が D1 から最新 snapshot を取得
  DO が接続直後に snapshot を送信
```

`canVote` や自分が投票済みかどうかなど、接続者ごとに異なる状態は共有スナップショットへ含めない。投票 API のレスポンスと初回表示用 API で管理する。

## エラー方針

| ケース | HTTP status | 備考 |
| --- | ---: | --- |
| 存在しない room / question | 404 | ルーム ID の推測に情報を出しすぎない |
| room closed | 403 または 409 | 投票不可 |
| question inactive | 409 | 現在投票中ではない |
| 重複投票 | 409 | `already_voted` などの code を返す |
| 不正な選択肢 | 400 | option が question に属していない |
| 管理パスワード不正 | 401 または 403 | 主催者セッション発行時 |
| host session 不正 | 401 または 403 | 主催者操作のみ |

## セキュリティとプライバシー

- ユーザーテーブルは作らない。
- IP address は保存しない。
- user agent は保存しない。
- `admin_password` は生値保存しない。
- `host_session_token` は生値保存しない。
- `anonymous_session_id` は生値保存しない。
- DB には `admin_password_hash`、`host_sessions.token_hash`、`voter_key_hash` を保存する。
- HMAC 用の `server_secret` は Cloudflare Workers Secrets で管理する。
- 投票 API は CSRF を考慮する。SameSite=Lax を基本にし、必要に応じて host 操作用 API には CSRF token を追加する。

## 実装単位

```text
src/
  index.ts
    Worker entrypoint
    API routing

  room-events.ts
    Durable Object class
    SSE connection handling
    broadcast

  db.ts
    D1 query functions

  auth.ts
    admin password hash
    host session token hash
    anonymous session
    HMAC helpers

  validators.ts
    request validation
```

## 参考

- データベース設計: `database-design.md`
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Cloudflare Workers EventSource: https://developers.cloudflare.com/workers/runtime-apis/eventsource/
- Cloudflare Workers Streams: https://developers.cloudflare.com/workers/runtime-apis/streams/
