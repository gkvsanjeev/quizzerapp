import { api } from './api'
import type {
  Paginated,
} from '@/types/exam'
import type {
  Question,
  QuestionCreatePayload,
  QuestionFilters,
  QuestionUpdatePayload,
} from '@/types/question'

export const questionsApi = {
  list: (filters: QuestionFilters = {}) =>
    api.get<Paginated<Question>>('/api/questions', { params: filters }).then((r) => r.data),

  create: (data: QuestionCreatePayload) =>
    api.post<Question>('/api/questions', data).then((r) => r.data),

  update: (questionId: string, data: QuestionUpdatePayload) =>
    api.put<Question>(`/api/questions/${questionId}`, data).then((r) => r.data),

  remove: (questionId: string) =>
    api.delete(`/api/questions/${questionId}`).then((r) => r.data),
}
