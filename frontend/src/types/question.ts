export type Difficulty = 'easy' | 'medium' | 'hard'
export type OptionKey = 'A' | 'B' | 'C' | 'D'

export interface Option {
  id: string
  option_key: OptionKey
  text: string
  image_url: string | null
}

export interface OptionInput {
  option_key: OptionKey
  text: string
  image_url?: string | null
  is_correct: boolean
}

export interface Question {
  id: string
  subject_id: string
  topic_id: string | null
  text: string
  image_url: string | null
  difficulty: Difficulty
  explanation: string | null
  tags: string[]
  source_doc_id: string | null
  created_at: string
  options: Option[]
}

export interface QuestionCreatePayload {
  subject_id: string
  text: string
  difficulty: Difficulty
  options: OptionInput[]
  topic_id?: string | null
  image_url?: string | null
  explanation?: string | null
  tags?: string[]
}

export interface QuestionUpdatePayload {
  text?: string
  image_url?: string | null
  difficulty?: Difficulty
  explanation?: string | null
  tags?: string[]
}

export interface QuestionFilters {
  subject_id?: string
  topic_id?: string
  difficulty?: Difficulty
  page?: number
  limit?: number
}
