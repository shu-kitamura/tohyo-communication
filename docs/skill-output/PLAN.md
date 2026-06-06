# 実装計画: DO スナップショットキャッシュ

## 概要

D1 を Source of Truth とし、Durable Object は room 単位の表示用スナップショットと SSE 接続だけを保持する。D1 の更新時に `state_version` を進め、DO は新しい version のスナップショットだけを適用する。

## 要件

- 書き込みと状態判定は D1 で完結させる。
- 更新ごとの D1 読み取りを接続者数に比例させない。
- DO の再起動や通知失敗後も D1 から復元できる。
- 古い通知や再送で DO の状態を巻き戻さない。
- 主催者向けと参加者向けで公開可能な情報を分ける。

## アーキテクチャ変更

- `docs/system-design.md`: SSE を通知専用から version 付きスナップショット配信へ変更する。
- `docs/database-design.md`: `rooms.state_version` と更新トランザクションのルールを追加する。
- `TODO.md`: payload、再同期、通知失敗、公開範囲の未確定事項を整理する。

## 実装手順

### フェーズ1: 設計文書

1. **データ責務と更新フローを更新する** (File: `docs/system-design.md`)
   - Action: D1 更新、スナップショット生成、DO 適用、SSE 配信の順序を定義する。
   - Why: キャッシュの整合性と復旧方法を明確にする。
   - Dependencies: なし
   - Risk: 中

2. **version 管理を DB 設計へ追加する** (File: `docs/database-design.md`)
   - Action: `rooms.state_version` と同一トランザクション内での更新ルールを記載する。
   - Why: 並行更新の順序を D1 側で確定する。
   - Dependencies: ステップ1
   - Risk: 中

3. **未確定事項を TODO に反映する** (File: `TODO.md`)
   - Action: host/participant payload、通知失敗、再接続、SSE 運用を追加する。
   - Why: 実装前に必要な判断を残す。
   - Dependencies: ステップ1
   - Risk: 低

## テスト戦略

- 文書確認: D1、DO、ブラウザの責務に矛盾がないことを確認する。
- 整合性確認: 投票、質問開始・終了、SSE 再接続、DO 再起動の各フローを追跡する。
- 実装時テスト: 通知順序逆転、通知失敗、同時投票、close と vote の競合を追加する。

## リスクと対策

- **Risk**: D1 更新後に DO 通知が失敗する。
  - Mitigation: 通知を短時間再試行し、次回更新または SSE 再接続時に最新スナップショットで復旧する。
- **Risk**: 古い通知が後から届く。
  - Mitigation: DO は保持中の `stateVersion` 以下を無視する。
- **Risk**: 参加者に非公開の結果が漏れる。
  - Mitigation: Worker で接続者種別を検証し、DO が payload を分けて配信する。

## 成功基準

- [x] D1 が唯一の Source of Truth と明記されている。
- [x] DO の状態が D1 から復元可能になっている。
- [x] `state_version` の更新・比較ルールが定義されている。
- [x] 更新1回につき接続者数分の D1 SELECT が発生しない。
- [x] 通知失敗と SSE 再接続時の復旧方針が定義されている。
