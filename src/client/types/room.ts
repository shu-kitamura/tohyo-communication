export type QuestionType = "single" | "multiple";

export interface QuestionDraft {
  title: string;
  questionType: QuestionType;
  options: string[];
}

export interface RoomCreationNavigationState {
  roomTitle: string;
}
