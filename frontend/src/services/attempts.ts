import { api } from './api'
import type {
  AnswerUpdatePayload,
  AttemptResult,
  AttemptState,
  AttemptSummary,
} from '@/types/attempt'

export const attemptsApi = {
  start: (testPaperId: string) =>
    api.post<AttemptState>('/api/attempts', { test_paper_id: testPaperId }).then((r) => r.data),

  get: (attemptId: string) =>
    api.get<AttemptState>(`/api/attempts/${attemptId}`).then((r) => r.data),

  saveAnswer: (attemptId: string, data: AnswerUpdatePayload) =>
    api.put<{ saved: boolean }>(`/api/attempts/${attemptId}/answer`, data).then((r) => r.data),

  submit: (attemptId: string) =>
    api.post<AttemptResult>(`/api/attempts/${attemptId}/submit`).then((r) => r.data),

  list: (params: { test_paper_id?: string } = {}) =>
    api.get<AttemptSummary[]>('/api/attempts', { params }).then((r) => r.data),
}
