# 投票アプリ データベース設計

## 前提

- RDBMS を想定する。PostgreSQL なら `uuid`、SQLite などを使う場合は UUID 文字列を `text` として保存する。
- 日時は UTC で保存する。
- テーブル名は複数形に統一する。
- 管理パスワード、主催者セッショントークン、投票者識別子は、生値ではなくハッシュ化して保存する。
- ユーザー登録やログインは作らない。重複投票制御は匿名セッション Cookie 由来の `voter_key_hash` で行う。
- 匿名投票のため、IP address や user agent は保存しない。
- `single` / `multiple` の両方を安全に扱うため、投票は「1回の投票提出」を表す `votes` と、「その投票で選ばれた選択肢」を表す `vote_choices` に分ける。

## ER 構造

```text
rooms
  ├─ host_sessions
  └─ questions
       ├─ options
       └─ votes
            └─ vote_choices
```

## rooms テーブル

投票ルームを表す。ルーム単位で公開・終了状態と主催者操作権限を管理する。

| カラム | 型 | NULL | 説明 |
| --- | ---: | :---: | --- |
| id | uuid / text | NO | ルームID。公開URLなどで使う識別子 |
| title | text | NO | 投票ルーム名 |
| status | text | NO | `open` / `closed` |
| admin_password_hash | text | NO | 管理パスワードのハッシュ |
| created_at | datetime | NO | 作成日時 |
| updated_at | datetime | NO | 更新日時 |
| closed_at | datetime | YES | 終了日時 |

### 制約

- Primary key: `id`
- `status IN ('open', 'closed')`
- `status = 'open'` のとき `closed_at IS NULL`
- `status = 'closed'` のとき `closed_at IS NOT NULL`

### インデックス

- `rooms(status)`
- `rooms(created_at)`

## host_sessions テーブル

主催者操作用のセッションを表す。管理パスワードの検証に成功したときに発行する。

| カラム | 型 | NULL | 説明 |
| --- | ---: | :---: | --- |
| id | uuid / text | NO | セッションID |
| room_id | uuid / text | NO | `rooms.id` |
| token_hash | text | NO | 主催者セッショントークンのハッシュ |
| created_at | datetime | NO | 作成日時 |
| expires_at | datetime | NO | 有効期限 |
| last_used_at | datetime | YES | 最終利用日時 |
| revoked_at | datetime | YES | 失効日時 |

### 管理パスワードとセッションについて

- ルームごとに管理パスワードを作る。
- 管理パスワードが正しければ、新しい主催者セッショントークンを発行する。
- 複数人が同じ管理パスワードを知っている場合、それぞれが主催者セッションを取得できる。これは複数ホスト機能として扱う。
- 管理パスワードを失うと、主催者権限は復旧できない。
- 管理パスワードの生値、主催者セッショントークンの生値は保存しない。
- `admin_password_hash` には、ハッシュ方式、salt、パラメータ、hash を含めた文字列を保存する。
- `token_hash` は、主催者セッショントークンを HMAC した値を保存する。

### 制約

- Primary key: `id`
- Foreign key: `room_id REFERENCES rooms(id) ON DELETE CASCADE`
- `UNIQUE(token_hash)`
- `expires_at > created_at`

### インデックス

- `host_sessions(room_id, created_at)`
- `host_sessions(token_hash)`
- `host_sessions(expires_at)`

## questions テーブル

ルーム内の質問を表す。質問単位で投票形式、公開状態、選択可能数を管理する。

| カラム | 型 | NULL | 説明 |
| --- | ---: | :---: | --- |
| id | uuid / text | NO | 質問ID |
| room_id | uuid / text | NO | `rooms.id` |
| title | text | NO | 質問文 |
| question_type | text | NO | `single` / `multiple` |
| status | text | NO | `draft` / `active` / `closed` |
| min_choices | integer | NO | 最低選択数。通常は `1` |
| max_choices | integer | NO | 最大選択数。`single` は `1` |
| sort_order | integer | NO | ルーム内での表示順 |
| created_at | datetime | NO | 作成日時 |
| updated_at | datetime | NO | 更新日時 |
| opened_at | datetime | YES | 投票開始日時 |
| closed_at | datetime | YES | 投票終了日時 |

### `is_active` について

元案の `is_active` は `status = 'active'` で表現する。`draft` と `closed` を区別できるため、boolean より運用しやすい。

### 制約

- Primary key: `id`
- Foreign key: `room_id REFERENCES rooms(id) ON DELETE CASCADE`
- `question_type IN ('single', 'multiple')`
- `status IN ('draft', 'active', 'closed')`
- `min_choices >= 1`
- `max_choices >= min_choices`
- `question_type = 'single'` のとき `min_choices = 1 AND max_choices = 1`
- 1ルームで同時に1問だけ投票中にする場合は、`room_id` ごとに `status = 'active'` の質問が1件だけになるように制約する。

PostgreSQL の例:

```sql
CREATE UNIQUE INDEX uq_questions_one_active_per_room
  ON questions (room_id)
  WHERE status = 'active';
```

### インデックス

- `questions(room_id, sort_order)`
- `questions(room_id, status)`
- `questions(created_at)`

## options テーブル

質問に対する選択肢を表す。

| カラム | 型 | NULL | 説明 |
| --- | ---: | :---: | --- |
| id | uuid / text | NO | 選択肢ID |
| question_id | uuid / text | NO | `questions.id` |
| label | text | NO | 選択肢名 |
| sort_order | integer | NO | 表示順 |
| is_enabled | boolean | NO | 投票受付対象か。作成後に一時的に無効化したい場合に使う |
| created_at | datetime | NO | 作成日時 |
| updated_at | datetime | NO | 更新日時 |

### 制約

- Primary key: `id`
- Foreign key: `question_id REFERENCES questions(id) ON DELETE CASCADE`
- `sort_order >= 0`
- `UNIQUE(question_id, sort_order)`
- `UNIQUE(question_id, id)` を追加しておくと、`vote_choices` で「その質問に属する選択肢だけを選べる」制約を張りやすい。
- 運用上、同一質問内で同じ選択肢名を禁止したい場合は `UNIQUE(question_id, label)` を追加する。

### インデックス

- `options(question_id, sort_order)`
- `options(question_id, is_enabled)`

## votes テーブル

投票者が質問に対して行った「1回の投票提出」を表す。選択した選択肢は `vote_choices` に保存する。

| カラム | 型 | NULL | 説明 |
| --- | ---: | :---: | --- |
| id | uuid / text | NO | 投票ID |
| question_id | uuid / text | NO | `questions.id` |
| voter_key_hash | text | NO | 同一人物の重複投票制御用キーのハッシュ |
| created_at | datetime | NO | 投票日時 |

### `voter_key_hash` について

- ルーム入室時に発行する匿名セッション Cookie から作った `voter_key` を HMAC して保存する。
- `voter_key` の生値は保存しない。
- 同じブラウザ・同じルーム内では、同じ質問に1回だけ投票できるようにする。
- Cookie を削除する、別ブラウザを使う、別端末を使う、といった再投票は防げない。匿名投票としてこの制約は仕様として扱う。

### 制約

- Primary key: `id`
- Foreign key: `question_id REFERENCES questions(id) ON DELETE CASCADE`
- `UNIQUE(id, question_id)` を追加しておくと、`vote_choices` 側の複合外部キーで整合性を保ちやすい。
- 同じ投票者が同じ質問に1回だけ投票できるようにする。

PostgreSQL の例:

```sql
CREATE UNIQUE INDEX uq_votes_one_per_voter_per_question
  ON votes (question_id, voter_key_hash);
```

### インデックス

- `votes(question_id, created_at)`
- `votes(question_id, voter_key_hash)`

## vote_choices テーブル

1回の投票で選択された選択肢を表す。`single` の場合は1件、`multiple` の場合は複数件入る。

| カラム | 型 | NULL | 説明 |
| --- | ---: | :---: | --- |
| vote_id | uuid / text | NO | `votes.id` |
| question_id | uuid / text | NO | `questions.id`。複合外部キー用に保持する |
| option_id | uuid / text | NO | `options.id` |
| created_at | datetime | NO | 作成日時 |

### 制約

- Primary key: `(vote_id, option_id)`
- Foreign key: `(vote_id, question_id) REFERENCES votes(id, question_id) ON DELETE CASCADE`
- Foreign key: `(question_id, option_id) REFERENCES options(question_id, id) ON DELETE CASCADE`
- これにより、投票対象の質問に属していない選択肢を誤って保存することを防ぐ。

### インデックス

- `vote_choices(question_id, option_id)`
- `vote_choices(option_id)`

## 投票時のバリデーション

投票作成はトランザクションで行う。

1. `rooms.status = 'open'` を確認する。
2. `questions.status = 'active'` を確認する。
3. 選択された `options` がすべて対象 `question_id` に属し、`is_enabled = true` であることを確認する。
4. 選択数が `min_choices` 以上、`max_choices` 以下であることを確認する。
5. 重複投票は、`votes(question_id, voter_key_hash)` のユニーク制約で防ぐ。
6. `votes` を1件作成する。
7. 選択された選択肢ごとに `vote_choices` を作成する。

## 集計クエリの考え方

選択肢ごとの得票数は `options` を起点に `vote_choices` を集計する。票が0件の選択肢も表示できる。

```sql
SELECT
  o.id,
  o.label,
  COUNT(vc.option_id) AS vote_count
FROM options o
LEFT JOIN vote_choices vc
  ON vc.option_id = o.id
WHERE o.question_id = :question_id
GROUP BY o.id, o.label, o.sort_order
ORDER BY o.sort_order ASC;
```

投票者数を数える場合は `votes` を数える。複数選択では `vote_choices` の件数が投票者数より多くなる点に注意する。

```sql
SELECT COUNT(*) AS voter_count
FROM votes
WHERE question_id = :question_id;
```

## 元案の4テーブル構成に寄せる場合

`vote_choices` を追加せず、`votes` に `option_id` を持たせる設計も可能。ただし、`multiple` では1回の投票が複数行に分かれるため、以下のような問題が出やすい。

- 1回の投票提出としてのまとまりを表現しにくい。
- `single` では同一投票者が1選択肢だけ、`multiple` では複数選択肢を許可する、という制約を DB だけで表現しにくい。
- 投票者数と選択数の集計が混ざりやすい。

4テーブルに限定する必要がある場合は、`votes` に `submission_id` を追加して、同じ `submission_id` を1回の投票として扱う。

| カラム | 型 | NULL | 説明 |
| --- | ---: | :---: | --- |
| id | uuid / text | NO | 投票選択行ID |
| submission_id | uuid / text | NO | 1回の投票提出ID |
| question_id | uuid / text | NO | `questions.id` |
| option_id | uuid / text | NO | `options.id` |
| voter_key_hash | text | NO | 同一人物の重複投票制御用キーのハッシュ |
| created_at | datetime | NO | 投票日時 |

この場合でも、実装の明確さと制約の張りやすさを考えると、推奨は `votes` + `vote_choices` の5テーブル構成。
