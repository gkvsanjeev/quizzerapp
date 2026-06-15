import type { Difficulty } from './question'

export type QuestionResult = 'correct' | 'incorrect' | 'unattempted'

export interface Overview {
  score: number
  max_score: number
  percentage: number
  rank: number | null
  percentile: number | null
  total_questions: number
  attempted: number
  correct: number
  incorrect: number
  unattempted: number
  accuracy_percentage: number
  time_taken_seconds: number
  duration_seconds: number
  topper_score: number | null
  average_score: number | null
}

export interface SubjectPerformance {
  name: string
  score: number
  max_score: number
  percentage: number
  topper_score: number | null
  average_score: number | null
}

export interface Performance {
  subjects: SubjectPerformance[]
}

export interface SubjectTime {
  name: string
  time_seconds: number
}

export interface TimeByDifficulty {
  easy: number
  medium: number
  hard: number
}

export interface QuestionTime {
  question_id: string
  time_seconds: number
  difficulty: Difficulty
  result: QuestionResult
}

export interface TimeAnalysis {
  total_time_seconds: number
  avg_time_per_question_seconds: number
  subjects: SubjectTime[]
  difficulty: TimeByDifficulty
  questions: QuestionTime[]
}

export interface AttemptsBreakdown {
  correct: number
  incorrect: number
  skipped: number
  unattempted: number
  marked_for_review: number
  net_score: number
  gross_score: number
  negative_marks: number
}

export interface DifficultyBucket {
  total: number
  correct: number
  incorrect: number
  unattempted: number
  accuracy: number
}

export interface DifficultyBreakdown {
  easy: DifficultyBucket
  medium: DifficultyBucket
  hard: DifficultyBucket
}

export interface SubjectTransition {
  from_subject: string
  to_subject: string
  at_question_number: number
  at_time_seconds: number
}

export interface TimeInSubject {
  subject: string
  total_seconds: number
  visit_count: number
}

export interface SubjectMovement {
  transitions: SubjectTransition[]
  time_in_subject: TimeInSubject[]
}

export type JourneyEventType =
  | 'visited'
  | 'answered'
  | 'marked_for_review'
  | 'revisited'
  | 'answer_changed'

export interface JourneyEntry {
  question_id: string
  question_number: number
  event: JourneyEventType
  timestamp_seconds: number
}

export interface QuestionJourney {
  events: JourneyEntry[]
}

export interface QuestionDetailOption {
  option_key: string
  text: string
  is_correct: boolean
  selected: boolean
}

export interface QuestionDetail {
  question_id: string
  question_number: number
  text: string
  difficulty: Difficulty
  subject: string
  topic: string | null
  your_answer: string | null
  correct_answer: string | null
  is_correct: boolean
  time_spent_seconds: number
  visit_count: number
  change_count: number
  is_marked_for_review: boolean
  explanation: string | null
  options: QuestionDetailOption[]
}

export interface QuestionListItem {
  question_id: string
  question_number: number
  subject: string
  topic: string | null
  difficulty: Difficulty
  your_answer: string | null
  correct_answer: string | null
  is_correct: boolean
  time_spent_seconds: number
  result: QuestionResult
}

export interface QuestionList {
  questions: QuestionListItem[]
}

export interface QuestionListFilters {
  subject_id?: string
  result?: QuestionResult
}
