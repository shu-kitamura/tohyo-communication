# ER図

D1に保存する永続データの関係です。Durable Objectは投票データを永続化せず、D1から生成されたsnapshotを一時的に保持します。

```mermaid
erDiagram
  rooms ||--o{ host_sessions : "issues"
  rooms ||--o{ questions : "has"
  questions ||--o{ options : "has"
  questions ||--o{ votes : "receives"
  votes ||--o{ vote_choices : "contains"
  options ||--o{ vote_choices : "selected as"

  rooms {
    text id PK
    text title
    text status "open | closed"
    text admin_password_hash
    integer state_version
    text created_at
    text updated_at
    text closed_at
  }

  host_sessions {
    text id PK
    text room_id FK
    text token_hash UK
    text created_at
    text expires_at
    text last_used_at
    text revoked_at
  }

  questions {
    text id PK
    text room_id FK
    text title
    text question_type "single | multiple"
    text status "draft | active | closed"
    integer min_choices
    integer max_choices
    integer sort_order
    text created_at
    text updated_at
    text opened_at
    text closed_at
  }

  options {
    text id PK
    text question_id FK
    text label
    integer sort_order
    integer is_enabled
    text created_at
    text updated_at
  }

  votes {
    text id PK
    text question_id FK
    text voter_key_hash
    text created_at
  }

  vote_choices {
    text vote_id PK,FK
    text question_id FK
    text option_id PK,FK
    text created_at
  }
```

## 主な制約

| テーブル | 制約 | 目的 |
| --- | --- | --- |
| `rooms` | `status` と `closed_at` の整合性 | `open` は `closed_at` なし、`closed` は `closed_at` ありにする |
| `host_sessions` | `UNIQUE(token_hash)` | ホストセッショントークンの重複防止 |
| `questions` | `UNIQUE(room_id, sort_order)` | ルーム内の質問表示順を一意にする |
| `options` | `UNIQUE(question_id, sort_order)` | 質問内の選択肢表示順を一意にする |
| `options` | `UNIQUE(question_id, id)` | `vote_choices` から「質問に属する選択肢」を参照する |
| `votes` | `UNIQUE(question_id, voter_key_hash)` | 同じ匿名セッションから同一質問への重複投票を防ぐ |
| `votes` | `UNIQUE(id, question_id)` | `vote_choices` から「質問に属する投票」を参照する |
| `vote_choices` | `PRIMARY KEY(vote_id, option_id)` | 1回の投票内で同じ選択肢を重複保存しない |

## 削除方針

- `rooms` を削除すると、`host_sessions`、`questions`、`options`、`votes`、`vote_choices` は `ON DELETE CASCADE` で削除されます。
- 終了済みルームは `closed_at` から30日間保持し、日次Cronで削除します。
