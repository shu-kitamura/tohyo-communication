# 開発フロー図

Issue作成からCodexによる要件整理、実装PR、レビュー、Cloudflare Workersへのデプロイまでの流れです。

```mermaid
flowchart TD
  issue["1. Issue作成"]
  planLabel["2. Label付与<br/>codex-plan"]
  planAction["3. GitHub Actions<br/>codex-plan"]
  planComment["CodexがIssue内容を確認<br/>不足点・受入条件をコメント"]
  needsFix{"Issue内容の修正が必要?"}
  updateIssue["4. Issue修正"]

  autofixLabel["5. Label付与<br/>codex-autofix"]
  autofixAction["6. GitHub Actions<br/>codex-autofix"]
  pr["Codexが実装<br/>Branch / Commit / Push / PR作成"]
  ci["CI<br/>check / test / build"]
  review["7. レビュー<br/>Codex / 人間"]
  needsChange{"修正が必要?"}
  fix["8. レビュー内容に基づき修正<br/>Codex or 人間"]
  merge["9. Merge"]
  deploy["10. Cloudflareへデプロイ<br/>Workersのデプロイ機能"]

  issue --> planLabel
  planLabel --> planAction
  planAction --> planComment
  planComment --> needsFix
  needsFix -->|"必要"| updateIssue
  updateIssue --> planLabel
  needsFix -->|"不要"| autofixLabel

  autofixLabel --> autofixAction
  autofixAction --> pr
  pr --> ci
  ci --> review
  review --> needsChange
  needsChange -->|"必要"| fix
  fix --> ci
  needsChange -->|"不要"| merge
  merge --> deploy
```

## トリガー

| 操作 | 実行されるworkflow | 役割 |
| --- | --- | --- |
| Issueに `codex-plan` ラベルを付与 | `.github/workflows/codex-plan.yaml` | Issueの要件、受入条件、不足点を整理してコメント |
| Issueに `codex-autofix` ラベルを付与 | `.github/workflows/codex-autofix.yaml` | Issue内容に基づいて実装し、PRを作成 |
| PR作成・push | `.github/workflows/ci.yaml` | `pnpm check`、`pnpm test`、`pnpm build` を実行 |

## 補足

- `codex-plan` の結果に不足点がある場合はIssue本文を修正し、再度 `codex-plan` を実行します。
- `codex-autofix` はIssue内容をもとにBranch作成、実装、Commit、Push、PR作成を行います。
- レビュー後の修正はCodexでも人間でも行えます。
- Merge後のデプロイはCloudflare Workersのデプロイ機能で行います。
