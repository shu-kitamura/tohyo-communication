# JSDoc ガイドライン

## 目的

このプロジェクトでは、コードの可読性と保守性を向上させるためにJSDocコメントを使用します。

JSDocは以下の目的で活用します：

- **意図の明確化**: 関数やクラスの目的、パラメータの役割、戻り値の意味を明示
- **型情報の補完**: TypeScriptの型システムだけでは表現しづらい制約や前提条件を記述
- **エディタ支援**: IDEのインテリセンスやホバー表示による開発体験の向上

## 基本タグ

プロジェクトで使用する主要なJSDocタグ：

### `@param`

関数のパラメータを説明します。

```typescript
/**
 * @param sessionId - セッションの一意識別子
 * @param voterToken - 投票者を識別するトークン
 */
```

### `@returns`

関数の戻り値を説明します。

```typescript
/**
 * @returns セッション情報を含むSession型のオブジェクト、見つからない場合はundefined
 */
```

### `@throws`

関数が投げる可能性のあるエラーを説明します（該当する場合のみ）。

```typescript
/**
 * @throws {Error} セッションIDが不正な形式の場合
 */
```

## ドキュメント対象

### 関数

公開関数（exportされている関数）には必ずJSDocを付けます。

```typescript
/**
 * セッションIDから投票セッション情報を取得します
 *
 * @param sessionId - 取得するセッションの一意識別子
 * @returns セッション情報、存在しない場合はundefined
 */
export function getSession(sessionId: string): Session | undefined {
  // ...
}
```

### クラス

exportされているクラスには、クラス全体の目的とメソッドにJSDocを付けます。

```typescript
/**
 * Durable Objectとして動作する投票セッション管理クラス
 *
 * 各セッションごとに独立したインスタンスが立ち上がり、
 * 投票データの整合性と永続化を担保します。
 */
export class VoteSessionDO implements DurableObject {
  /**
   * 投票を受け付けて票数を更新します
   *
   * @param request - 投票リクエスト（choiceIdsとvoterTokenを含む）
   * @returns 投票結果を含むレスポンス
   */
  async handleVote(request: Request): Promise<Response> {
    // ...
  }
}
```

### インターフェース / 型

重要なインターフェースや型定義には、その目的や使用場面を説明します。

```typescript
/**
 * 投票セッションを表すデータモデル
 *
 * Durable Object内で永続化され、リアルタイムに更新されます。
 */
export interface Session {
  /** セッションの一意識別子 */
  sessionId: string;
  /** 投票の質問文 */
  question: string;
  /** 単一選択か複数選択かを示すタイプ */
  voteType: VoteType;
  /** 投票の選択肢リスト */
  choices: Choice[];
  /** セッションの状態（active / closed） */
  status: SessionStatus;
  /** セッション作成日時 */
  createdAt: Date;
  /** セッション終了日時（終了済みの場合のみ） */
  closedAt?: Date;
}
```

## スタイルガイド

### 簡潔かつ明示的に

- 型名を単純に繰り返すだけのコメントは避ける
- パラメータや戻り値の「意味」や「制約」を説明する

❌ 悪い例：

```typescript
/**
 * @param sessionId - session id
 */
```

✅ 良い例：

```typescript
/**
 * @param sessionId - セッションの一意識別子（UUID v4形式）
 */
```

### 「なぜ」を説明する

実装が自明でない場合や、特定の理由で設計された部分には「なぜ」その処理が必要かを説明します。

```typescript
/**
 * セッションを24時間後に自動削除するアラームを設定します
 *
 * NOTE: Durable Objectのストレージは永続化されるため、
 * 古いセッションデータを自動削除してストレージコストを抑える目的。
 */
await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
```

### 日本語で記述

コメントはプロジェクトメンバーが読みやすいよう、日本語で記述します。  
ただし、コード（変数名・関数名）は英語を使用します。

## 注意事項

- 既存の型定義を真実の情報源（Source of Truth）とし、矛盾しないようにする
- 冗長なコメントは避け、明確さを優先する
- 実装変更時にはJSDocも同時に更新する
