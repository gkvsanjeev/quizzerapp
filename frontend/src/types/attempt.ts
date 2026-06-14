import type { Difficulty, OptionKey } from './question'

export interface OptionStudent {
  id: string
  option_key: OptionKey
  text: string
  image_url: string | null
}

export interface QuestionStudent {
  id: string
  text: string
  image_url: string | null
  difficulty: Difficulty
  subject: string
  topic: string | null
  options: OptionStudent[]
}

export interface TestPaperBrief {
  id: string
  title: string
  duration_seconds: number
  total_marks: number
}

export interface AnswerState {
  selected_option_id: string | null
  is_marked_for_review: boolean
  visit_count: number
}

export interface AttemptState {
  attempt_id: string
  test_paper: TestPaperBrief
  questions: QuestionStudent[]
  answers: Record<string, AnswerState>
  started_at: string
  time_elapsed_seconds: number
}

export interface AnswerUpdatePayload {
  question_id: string
  selected_option_id?: string | null
  time_spent_delta_seconds?: number
  is_marked_for_review?: boolean
}

export interface AttemptResult {
  attempt_id: string
  raw_score: number
  final_score: number
  rank: number | null
  percentile: number | null
  total_questions: number
  attempted: number
  correct: number
  incorrect: number
}

export interface AttemptSummary {
  id: string
  test_paper_id: string
  test_paper_title: string
  status: string
  started_at: string
  submitted_at: string | null
  final_score: number | null
  rank: number | null
  percentile: number | null
}
