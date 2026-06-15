import { useQuery } from '@tanstack/react-query'
import { analysisApi } from '@/services/analysis'
import type { QuestionListFilters } from '@/types/analysis'

export const analysisKeys = {
  all: (attemptId: string) => ['analysis', attemptId] as const,
  section: (attemptId: string, section: string) => ['analysis', attemptId, section] as const,
  questions: (attemptId: string, filters: QuestionListFilters) =>
    ['analysis', attemptId, 'questions', filters] as const,
  question: (attemptId: string, questionId: string) =>
    ['analysis', attemptId, 'question', questionId] as const,
}

function section<T>(attemptId: string | undefined, key: string, fn: (id: string) => Promise<T>) {
  return useQuery({
    queryKey: analysisKeys.section(attemptId ?? '', key),
    queryFn: () => fn(attemptId as string),
    enabled: Boolean(attemptId),
    staleTime: 5 * 60 * 1000, // analysis of a submitted attempt is immutable
  })
}

export const useOverview = (attemptId?: string) =>
  section(attemptId, 'overview', analysisApi.overview)

export const usePerformance = (attemptId?: string) =>
  section(attemptId, 'performance', analysisApi.performance)

export const useTimeAnalysis = (attemptId?: string) =>
  section(attemptId, 'time', analysisApi.time)

export const useAttemptsBreakdown = (attemptId?: string) =>
  section(attemptId, 'attempts', analysisApi.attempts)

export const useDifficultyBreakdown = (attemptId?: string) =>
  section(attemptId, 'difficulty', analysisApi.difficulty)

export const useSubjectMovement = (attemptId?: string) =>
  section(attemptId, 'subject-movement', analysisApi.subjectMovement)

export const useQuestionJourney = (attemptId?: string) =>
  section(attemptId, 'question-journey', analysisApi.questionJourney)

export function useQuestionList(attemptId: string | undefined, filters: QuestionListFilters = {}) {
  return useQuery({
    queryKey: analysisKeys.questions(attemptId ?? '', filters),
    queryFn: () => analysisApi.questions(attemptId as string, filters),
    enabled: Boolean(attemptId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useQuestionDetail(attemptId: string | undefined, questionId: string | undefined) {
  return useQuery({
    queryKey: analysisKeys.question(attemptId ?? '', questionId ?? ''),
    queryFn: () => analysisApi.questionDetail(attemptId as string, questionId as string),
    enabled: Boolean(attemptId && questionId),
    staleTime: 5 * 60 * 1000,
  })
}
