
export interface Question {
  id: string;
  question: string;
  alternatives: string[];
  correctAnswerIndex: number;
  timeLimitSeconds: number;
  basePoints: number;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: string;
  createdByUserId: string;
  isPublishedAsChallenge: boolean;
  showImmediateFeedback?: boolean;
  decreasePointsOverTime?: boolean;
}

export interface GamePlayer {
  nickname: string;
  score: number;
  lastAnswerCorrect: boolean | null;
  lastAnswerTime: number | null;
  joinedAt: number;
}

export interface GameRoom {
  id: string; // PIN
  quizId: string;
  hostId: string;
  status: 'waiting' | 'question' | 'results' | 'podium' | 'finished';
  currentQuestionIndex: number;
  questionStartTime: number | null;
  players: Record<string, GamePlayer>;
}

export interface ChallengeResult {
  id: string;
  challengeId: string;
  nickname: string;
  score: number;
  correctAnswers: number;
  totalTime: number;
  timestamp: number;
}
