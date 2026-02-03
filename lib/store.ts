// In-memory data store for voting sessions and votes
import { Session, Vote } from "./types";

/**
 * インメモリ投票データストアクラス
 *
 * NOTE: このストアは主に開発・テスト用です。
 * 本番環境ではDurable Objectを使用してデータを永続化しています。
 */
class VotingStore {
  private sessions = new Map<string, Session>();
  private votes = new Map<string, Vote[]>(); // sessionId -> votes[]
  private voterTokens = new Map<string, Set<string>>(); // sessionId -> Set of voterTokens

  // Session management
  /**
   * 新規セッションを作成し、ストアに登録します
   *
   * @param session - 作成するセッション
   */
  createSession(session: Session): void {
    this.sessions.set(session.sessionId, session);
    this.votes.set(session.sessionId, []);
    this.voterTokens.set(session.sessionId, new Set());
  }

  /**
   * セッションIDからセッション情報を取得します
   *
   * @param sessionId - 取得するセッションの一意識別子
   * @returns セッション情報、存在しない場合はundefined
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * セッション情報を更新します
   *
   * @param sessionId - 更新するセッションの一意識別子
   * @param session - 更新後のセッション情報
   */
  updateSession(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
  }

  /**
   * セッションと関連する投票データを削除します
   *
   * @param sessionId - 削除するセッションの一意識別子
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.votes.delete(sessionId);
    this.voterTokens.delete(sessionId);
  }

  // Vote management
  /**
   * 投票記録を追加し、投票者トークンを登録します
   *
   * @param vote - 追加する投票記録
   */
  addVote(vote: Vote): void {
    const sessionVotes = this.votes.get(vote.sessionId) || [];
    sessionVotes.push(vote);
    this.votes.set(vote.sessionId, sessionVotes);

    const tokens = this.voterTokens.get(vote.sessionId) || new Set();
    tokens.add(vote.voterToken);
    this.voterTokens.set(vote.sessionId, tokens);
  }

  /**
   * 特定の投票者がすでに投票済みかチェックします
   *
   * @param sessionId - セッションの一意識別子
   * @param voterToken - 投票者を識別するトークン
   * @returns 投票済みの場合true、未投票の場合false
   */
  hasVoted(sessionId: string, voterToken: string): boolean {
    const tokens = this.voterTokens.get(sessionId);
    return tokens ? tokens.has(voterToken) : false;
  }

  /**
   * セッションに対するすべての投票記録を取得します
   *
   * @param sessionId - セッションの一意識別子
   * @returns 投票記録の配列
   */
  getVotes(sessionId: string): Vote[] {
    return this.votes.get(sessionId) || [];
  }

  // Cleanup old sessions (24 hours timeout)
  /**
   * 24時間以上経過したセッションを自動削除します
   *
   * NOTE: 定期的に実行され、古いデータを削除してメモリを開放します。
   */
  cleanupOldSessions(): void {
    const now = new Date();
    const timeoutMs = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.createdAt.getTime();
      if (age > timeoutMs) {
        this.deleteSession(sessionId);
      }
    }
  }
}

// Singleton instance
/** シングルトンのVotingStoreインスタンス */
export const store = new VotingStore();

// Cleanup old sessions every hour
setInterval(
  () => {
    store.cleanupOldSessions();
  },
  60 * 60 * 1000,
);
