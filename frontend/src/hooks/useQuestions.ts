import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { questionsApi } from '@/services/questions'
import type {
  QuestionCreatePayload,
  QuestionFilters,
  QuestionUpdatePayload,
} from '@/types/question'

export const questionKeys = {
  all: ['questions'] as const,
  list: (filters: QuestionFilters) => ['questions', 'list', filters] as const,
}

export function useQuestions(filters: QuestionFilters = {}) {
  return useQuery({
    queryKey: questionKeys.list(filters),
    queryFn: () => questionsApi.list(filters),
  })
}

export function useCreateQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: QuestionCreatePayload) => questionsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}

export function useUpdateQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: QuestionUpdatePayload }) =>
      questionsApi.update(questionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}

export function useDeleteQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (questionId: string) => questionsApi.remove(questionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}
