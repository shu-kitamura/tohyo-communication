// Data models for the voting application

export type VoteType = "single" | "multiple";
export type SessionStatus = "active" | "closed";

export interface Choice {
  choiceId: string;
  text: string;
  voteCount: number;
}

export interface Session {
  sessionId: string;
  question: string;
  voteType: VoteType;
  choices: Choice[];
  status: SessionStatus;
  createdAt: Date;
  closedAt?: Date;
}

export interface Vote {
  voterToken: string;
  sessionId: string;
  choiceIds: string[];
  votedAt: Date;
}

// API request/response types
export interface CreateSessionRequest {
  question: string;
  voteType: VoteType;
  choices: { text: string }[];
}

export interface CreateSessionResponse {
  sessionId: string;
  voteUrl: string;
  createdAt: string;
}

export interface SubmitVoteRequest {
  choiceIds: string[];
}

export interface SubmitVoteResponse {
  message: string;
  votedAt: string;
}

export interface GetSessionResponse {
  sessionId: string;
  question: string;
  voteType: VoteType;
  choices: Omit<Choice, "voteCount">[] | Choice[];
  status: SessionStatus;
  canVote: boolean;
  message?: string;
}

export interface ExportJsonResponse {
  sessionId: string;
  question: string;
  voteType: VoteType;
  totalVotes: number;
  choices: Array<{
    text: string;
    voteCount: number;
    percentage: number;
  }>;
  exportedAt: string;
}
