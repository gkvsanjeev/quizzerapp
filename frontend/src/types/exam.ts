export interface Topic {
  id: string
  name: string
}

export interface Subject {
  id: string
  name: string
  order_index: number
  topics: Topic[]
}

export interface Exam {
  id: string
  title: string
  description: string | null
  exam_type: string
  is_published: boolean
  created_by: string
  created_at: string
  subjects?: Subject[] | null
}

export interface ExamCreatePayload {
  title: string
  exam_type: string
  description?: string
}

export interface ExamUpdatePayload {
  title?: string
  description?: string
  is_published?: boolean
}

export interface SubjectCreatePayload {
  name: string
  order_index?: number
}

export interface Paginated<T> {
  total: number
  page: number
  limit: number
  items: T[]
}
