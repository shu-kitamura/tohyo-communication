# 実装計画: Issue要件定義ワークフロー

## 概要

Issue #47では、実装前にIssueの要件と受入条件を整理する自動処理を追加する。既存の`codex-autofix`による実装PR作成とは別の`codex-plan`トリガーを用意し、要件定義と実装開始の責務を分離する。

## 要件

- Issue作成時、または`codex-plan`ラベル付与時に要件定義処理を起動する。
- 対象Issueの番号、URL、タイトル、本文をCodex処理へ渡す。
- 整理された要件、受入条件、不足点をIssueコメントとして残す。
- `codex-autofix`の実装PR作成フローとトリガーを混同しない。
- 不十分なIssue本文で`codex-autofix`が不用意に実装へ進まないようにする。

## アーキテクチャ変更

- `.github/workflows/issue-requirements-plan.yaml`: `opened`または`codex-plan`ラベルを契機に、要件定義専用のCodex実行とIssueコメント投稿を行う。
- `.github/workflows/issue-driven-pr.yaml`: 実装前にIssue本文が要件・受入条件を含むか確認し、不足時はコメントして実装をスキップする。

## 実装手順

### フェーズ1: 要件定義ワークフロー追加

1. **専用Workflowの作成** (File: `.github/workflows/issue-requirements-plan.yaml`)
   - Action: `issues.opened`と`issues.labeled`を監視し、`opened`または`codex-plan`ラベル時だけ実行する。
   - Why: Issue作成と要件定義ラベルの両方を入口にできるようにするため。
   - Dependencies: なし
   - Risk: 低

2. **Codex入力の明示化** (File: `.github/workflows/issue-requirements-plan.yaml`)
   - Action: Issue番号、URL、タイトル、本文を環境変数経由でプロンプトに含める。
   - Why: 処理対象をWorkflowログとCodex入力の両方で明確にするため。
   - Dependencies: ステップ1
   - Risk: 低

3. **Issueコメント投稿** (File: `.github/workflows/issue-requirements-plan.yaml`)
   - Action: Codexの最終出力をIssueコメントへ投稿する。
   - Why: 要件と受入条件の整理結果をIssue上に残すため。
   - Dependencies: ステップ2
   - Risk: 低

### フェーズ2: 実装PRフローの事前確認

1. **Issue本文チェックの追加** (File: `.github/workflows/issue-driven-pr.yaml`)
   - Action: `codex-autofix`実行前に要件・受入条件の見出しがあるか確認する。
   - Why: 不十分なIssue本文を前提に実装PR作成へ進ませないため。
   - Dependencies: なし
   - Risk: 中

2. **不足時コメント** (File: `.github/workflows/issue-driven-pr.yaml`)
   - Action: 不足している見出しと`codex-plan`ラベル利用をIssueコメントで案内する。
   - Why: 次に必要な作業をメンテナーが判断できるようにするため。
   - Dependencies: ステップ1
   - Risk: 低

## テスト戦略

- 静的検証: `pnpm check`
- ユニットテスト: `pnpm test`
- ビルド: `pnpm build`
- 手動確認: Workflow YAMLのトリガー、条件分岐、Issueコンテキスト参照を確認する。

## リスクと対策

- **Risk**: `codex-autofix`の既存運用で要件・受入条件見出しがないIssueが止まる。
  - Mitigation: 不足時コメントで`codex-plan`ラベル付与を案内し、実装前の要件整理に誘導する。

## 成功基準

- [x] `codex-plan`ラベル付与で要件定義Workflowが起動する。
- [x] Issue番号、URL、タイトル、本文が処理へ渡る。
- [x] 整理結果がIssueコメントに残る。
- [x] `codex-autofix`と`codex-plan`の責務が分離される。
- [x] 要件・受入条件が不足するIssueでは`codex-autofix`が実装へ進まない。
