export interface TestPaper {
  id: string
  exam_id: string
  title: string
  scheduled_at: string | null
  duration_seconds: number
  total_marks: number
  negative_marking_factor: number
  shuffle_questions: boolean
  shuffle_options: boolean
  created_at: string
}

export interface TestPaperCreatePayload {
  title: string
  duration_seconds: number
  total_marks: number
  scheduled_at?: string | null
  negative_marking_factor?: number
  shuffle_questions?: boolean
  shuffle_options?: boolean
}

export interface TestPaperQuestionAddItem {
  question_id: string
  display_order: number
  marks?: number
  negative_marks?: number
  subject_section?: string | null
}
