// Tipos do banco (escritos à mão para começar).
// Depois, gere automaticamente com:
//   npx supabase gen types typescript --project-id SEU_ID > src/lib/supabase/types.ts

export type GameStatus = 'waiting' | 'question' | 'results' | 'podium' | 'finished';

export interface QuizSettings {
  showImmediateFeedback?: boolean;
  decreasePointsOverTime?: boolean;
}

export interface GameSession {
  id: string;
  pin: string;
  quiz_id: string;
  org_id: string;
  host_id: string | null;
  status: GameStatus;
  current_question_index: number;
  question_started_at: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface GamePlayer {
  id: string;
  session_id: string;
  nickname: string;
  score: number;
  joined_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  alternatives: string[];
  correct_index: number;
  time_limit_seconds: number;
  base_points: number;
  image_url: string | null;
}

export interface Quiz {
  id: string;
  org_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  settings: QuizSettings;
  is_published_as_challenge: boolean;
  created_at: string;
  updated_at: string;
}

// Placeholder para o gerador oficial de tipos do Supabase.
export type Database = any;
