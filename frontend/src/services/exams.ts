import { api } from './api'
import type {
  Exam,
  ExamCreatePayload,
  ExamUpdatePayload,
  Paginated,
  Subject,
  SubjectCreatePayload,
} from '@/types/exam'

export interface ExamListParams {
  page?: number
  limit?: number
  exam_type?: string
  published?: boolean
}

export const examsApi = {
  list: (params: ExamListParams = {}) =>
    api.get<Paginated<Exam>>('/api/exams', { params }).then((r) => r.data),

  get: (examId: string) => api.get<Exam>(`/api/exams/${examId}`).then((r) => r.data),

  create: (data: ExamCreatePayload) =>
    api.post<Exam>('/api/exams', data).then((r) => r.data),

  update: (examId: string, data: ExamUpdatePayload) =>
    api.put<Exam>(`/api/exams/${examId}`, data).then((r) => r.data),

  listSubjects: (examId: string) =>
    api.get<Subject[]>(`/api/exams/${examId}/subjects`).then((r) => r.data),

  createSubject: (examId: string, data: SubjectCreatePayload) =>
    api.post<Subject>(`/api/exams/${examId}/subjects`, data).then((r) => r.data),
}
