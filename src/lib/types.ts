// 投票アプリケーションのデータモデル

/**
 * 投票タイプ
 * - single: 単一選択（1つだけ選択可能）
 * - multiple: 複数選択（複数の選択肢を選択可能）
 */
export type VoteType = "single" | "multiple";

/**
 * セッションの状態
 * - active: 投票受付中
 * - closed: 投票終了
 */
export type SessionStatus = "active" | "closed";

/**
 * 投票の選択肢を表すデータモデル
 */
export interface Choice {
  /** 選択肢の一意識別子 */
  choiceId: string;
  /** 選択肢のテキスト */
  text: string;
  /** この選択肢に投票された票数 */
  voteCount: number;
}

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

/**
 * 投票記録を表すデータモデル
 *
 * 注記: 現在のアーキテクチャではDurable Object内でvoterToken単位での
 * 重複チェックのみ行っており、Vote型の完全な記録は保存していません。
 */
export interface Vote {
  /** 投票者を識別するトークン */
  voterToken: string;
  /** 投票先のセッションID */
  sessionId: string;
  /** 投票した選択肢のIDリスト */
  choiceIds: string[];
  /** 投票日時 */
  votedAt: Date;
}

// APIのリクエスト/レスポンス型

/**
 * セッション作成APIのリクエスト型
 */
export interface CreateSessionRequest {
  /** 投票の質問文 */
  question: string;
  /** 投票タイプ（単一選択 / 複数選択） */
  voteType: VoteType;
  /** 選択肢のリスト（テキストのみ） */
  choices: { text: string }[];
}

/**
 * セッション作成APIのレスポンス型
 */
export interface CreateSessionResponse {
  /** 作成されたセッションの一意識別子 */
  sessionId: string;
  /** 参加者用の投票URL */
  voteUrl: string;
  /** セッション作成日時（ISO 8601形式） */
  createdAt: string;
}

/**
 * 投票送信APIのリクエスト型
 */
export interface SubmitVoteRequest {
  /** 投票する選択肢のIDリスト */
  choiceIds: string[];
}

/**
 * 投票送信APIのレスポンス型
 */
export interface SubmitVoteResponse {
  /** 投票完了メッセージ */
  message: string;
  /** 投票日時（ISO 8601形式） */
  votedAt: string;
}

/**
 * セッション情報取得APIのレスポンス型
 */
export interface GetSessionResponse {
  /** セッションの一意識別子 */
  sessionId: string;
  /** 投票の質問文 */
  question: string;
  /** 投票タイプ */
  voteType: VoteType;
  /** 選択肢リスト（参加者向けには票数を隠す場合あり） */
  choices: Omit<Choice, "voteCount">[] | Choice[];
  /** セッションの状態 */
  status: SessionStatus;
  /** 投票可能かどうか */
  canVote: boolean;
  /** ユーザーに表示するメッセージ（投票済み、終了済みなど） */
  message?: string;
}

/**
 * データエクスポートAPIのレスポンス型（JSON形式）
 */
export interface ExportJsonResponse {
  /** セッションの一意識別子 */
  sessionId: string;
  /** 投票の質問文 */
  question: string;
  /** 投票タイプ */
  voteType: VoteType;
  /** 合計投票数 */
  totalVotes: number;
  /** 選択肢ごとの集計結果 */
  choices: Array<{
    /** 選択肢のテキスト */
    text: string;
    /** 票数 */
    voteCount: number;
    /** 割合（パーセント） */
    percentage: number;
  }>;
  /** エクスポート日時（ISO 8601形式） */
  exportedAt: string;
}
