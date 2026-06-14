import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attemptsApi } from '@/services/attempts'
import type { AnswerUpdatePayload } from '@/types/attempt'

export const attemptKeys = {
  all: ['attempts'] as const,
  list: (params: { test_paper_id?: string }) => ['attempts', 'list', params] as const,
  detail: (id: string) => ['attempts', 'detail', id] as const,
}

/** Student exam history (own attempts). */
export function useAttemptsList(params: { test_paper_id?: string } = {}) {
  return useQuery({
    queryKey: attemptKeys.list(params),
    queryFn: () => attemptsApi.list(params),
  })
}

/** Resume / fetch a single attempt's full state. */
export function useAttempt(attemptId: string | undefined) {
  return useQuery({
    queryKey: attemptKeys.detail(attemptId ?? ''),
    queryFn: () => attemptsApi.get(attemptId as string),
    enabled: Boolean(attemptId),
    // The exam session is driven by the Zustand store, not by refetching.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useStartAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (testPaperId: string) => attemptsApi.start(testPaperId),
    onSuccess: () => qc.invalidateQueries({ queryKey: attemptKeys.all }),
  })
}

export function useSaveAnswer() {
  return useMutation({
    mutationFn: ({ attemptId, data }: { attemptId: string; data: AnswerUpdatePayload }) =>
      attemptsApi.saveAnswer(attemptId, data),
  })
}

export function useSubmitAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attemptId: string) => attemptsApi.submit(attemptId),
    onSuccess: () => qc.invalidateQueries({ queryKey: attemptKeys.all }),
  })
}
