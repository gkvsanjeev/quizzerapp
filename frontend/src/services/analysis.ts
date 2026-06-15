import { api } from './api'
import type {
  AttemptsBreakdown,
  DifficultyBreakdown,
  Overview,
  Performance,
  QuestionDetail,
  QuestionJourney,
  QuestionList,
  QuestionListFilters,
  SubjectMovement,
  TimeAnalysis,
} from '@/types/analysis'

const base = (attemptId: string) => `/api/analysis/${attemptId}`

export const analysisApi = {
  overview: (attemptId: string) =>
    api.get<Overview>(`${base(attemptId)}/overview`).then((r) => r.data),

  performance: (attemptId: string) =>
    api.get<Performance>(`${base(attemptId)}/performance`).then((r) => r.data),

  time: (attemptId: string) =>
    api.get<TimeAnalysis>(`${base(attemptId)}/time`).then((r) => r.data),

  attempts: (attemptId: string) =>
    api.get<AttemptsBreakdown>(`${base(attemptId)}/attempts`).then((r) => r.data),

  difficulty: (attemptId: string) =>
    api.get<DifficultyBreakdown>(`${base(attemptId)}/difficulty`).then((r) => r.data),

  subjectMovement: (attemptId: string) =>
    api.get<SubjectMovement>(`${base(attemptId)}/subject-movement`).then((r) => r.data),

  questionJourney: (attemptId: string) =>
    api.get<QuestionJourney>(`${base(attemptId)}/question-journey`).then((r) => r.data),

  questionDetail: (attemptId: string, questionId: string) =>
    api.get<QuestionDetail>(`${base(attemptId)}/question/${questionId}`).then((r) => r.data),

  questions: (attemptId: string, filters: QuestionListFilters = {}) =>
    api.get<QuestionList>(`${base(attemptId)}/questions`, { params: filters }).then((r) => r.data),
}
