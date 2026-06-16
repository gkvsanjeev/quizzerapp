export type DocStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface Document {
  id: string
  filename: string
  file_type: string
  processing_status: DocStatus
  page_count: number | null
  created_at: string
}

export interface GeneratedOption {
  option_key: 'A' | 'B' | 'C' | 'D'
  text: string
  is_correct: boolean
}

export interface GeneratedQuestion {
  text: string
  explanation: string
  options: GeneratedOption[]
}

export interface GenerateQuestionsPayload {
  document_id: string
  subject_id: string
  topic_id?: string | null
  count: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface SaveQuestionsPayload {
  subject_id: string
  topic_id?: string | null
  questions: GeneratedQuestion[]
}

export interface SaveQuestionsResult {
  saved_count: number
  question_ids: string[]
}

export interface ChunkResult {
  content: string
  page_number: number | null
  filename: string
  similarity_score: number
}

export interface SearchResult {
  chunks: ChunkResult[]
}
