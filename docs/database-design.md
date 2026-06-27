# データベース設計

D1を永続データのSource of Truthにします。Durable Objectには投票データを保存せず、D1から生成したsnapshotを一時的に持つだけです。

現在の実装はDrizzle schemaを [`src/server/db/schema.ts`](../src/server/db/schema.ts) に置き、migrationは [`drizzle/`](../drizzle/) に生成しています。

図解: [`docs/figure/database-er.md`](./figure/database-er.md)

## テーブル構成

```text
rooms
  ├─ host_sessions
  └─ questions
       ├─ options
       └─ votes
            └─ vote_choices
```

## rooms

投票ルームを表します。

| カラム | 説明 |
| --- | --- |
| `id` | UUID形式の公開ID |
| `title` | ルーム名 |
| `status` | `open` / `closed` |
| `admin_password_hash` | 管理パスワードのPBKDF2ハッシュ |
| `state_version` | snapshot更新順序 |
| `created_at` / `updated_at` / `closed_at` | 日時 |

`state_version` は、ゲスト/ホスト画面に影響する更新時に増やします。

新規ルームは128bitのUUIDを使います。移行前に作成した `room-xxxxxxxx` 形式のIDも、既存URLの互換性のため引き続き参照できます。

- 質問作成
- 質問開始
- 投票
- 質問終了
- ルーム終了

## host_sessions

ホスト操作用セッションです。管理パスワードの検証に成功したときに発行します。

| カラム | 説明 |
| --- | --- |
| `id` | セッションID |
| `room_id` | 対象ルーム |
| `token_hash` | ホストセッショントークンのSHA-256ハッシュ |
| `created_at` / `expires_at` | 作成日時と期限 |
| `last_used_at` / `revoked_at` | 将来拡張用 |

Cookieにはトークン生値を入れますが、D1には保存しません。D1には `token_hash` だけ保存します。

## questions

ルーム内の質問を表します。

| カラム | 説明 |
| --- | --- |
| `id` | 質問ID |
| `room_id` | 対象ルーム |
| `title` | 質問文 |
| `question_type` | `single` / `multiple` |
| `status` | `draft` / `active` / `closed` |
| `min_choices` / `max_choices` | 選択数制約 |
| `sort_order` | 表示順 |
| `opened_at` / `closed_at` | 開始/終了日時 |

同一ルーム内で複数の質問を同時に `active` にできます。初期migrationにあった「1ルーム1 active」のunique indexは、`0001_yielding_proteus.sql` で削除しています。

## options

質問ごとの選択肢です。

| カラム | 説明 |
| --- | --- |
| `id` | 選択肢ID |
| `question_id` | 対象質問 |
| `label` | 表示名 |
| `sort_order` | 表示順 |
| `is_enabled` | 投票受付対象か |

選択肢は質問内で2件から10件です。ラベルの重複はAPIバリデーションで拒否します。

## votes

1人が1つの質問へ行った「1回の投票提出」を表します。

| カラム | 説明 |
| --- | --- |
| `id` | 投票ID |
| `question_id` | 対象質問 |
| `voter_key_hash` | 匿名セッション由来の重複投票防止キー |
| `created_at` | 投票日時 |

`UNIQUE(question_id, voter_key_hash)` により、同じブラウザ/同じルーム内では同一質問に1回だけ投票できます。Cookie削除、別ブラウザ、別端末による再投票は匿名投票の仕様として許容します。

## vote_choices

1回の投票で選ばれた選択肢を表します。

| カラム | 説明 |
| --- | --- |
| `vote_id` | 投票ID |
| `question_id` | 対象質問 |
| `option_id` | 選択肢ID |
| `created_at` | 作成日時 |

`single` では1件、`multiple` では複数件保存します。複合外部キーで「対象質問に属する選択肢だけ」を保存できるようにしています。

## 投票時の更新

投票APIは以下を同じ処理内で行います。

1. ルームが `open` であることを確認する。
2. 質問が `active` であることを確認する。
3. 選択数と選択肢IDを検証する。
4. `votes` を作成する。
5. `vote_choices` を作成する。
6. `rooms.state_version` を増やす。
7. 最新snapshotを生成し、Durable Objectへ通知する。

## データ保持

終了済みルームは `closed_at` から30日間保持します。日次Cronが以下の条件で `rooms` を削除します。

```sql
status = 'closed' AND closed_at <= 保持期限
```

`rooms` を親として削除し、外部キーの `ON DELETE CASCADE` により以下も同じ処理で削除します。

- `host_sessions`
- `questions`
- `options`
- `votes`
- `vote_choices`

終了していないルームは自動削除しません。期限検索には `rooms(status, closed_at)` indexを使用します。

## まだ実装していない運用機能

- ホストセッションの一覧/失効
- 管理パスワード変更
