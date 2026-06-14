import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { testPapersApi } from '@/services/testPapers'
import type { TestPaperCreatePayload, TestPaperQuestionAddItem } from '@/types/testPaper'

export const testPaperKeys = {
  all: ['test-papers'] as const,
  forExam: (examId: string) => ['test-papers', 'exam', examId] as const,
}

export function useExamTestPapers(examId: string | undefined) {
  return useQuery({
    queryKey: testPaperKeys.forExam(examId ?? ''),
    queryFn: () => testPapersApi.listForExam(examId as string),
    enabled: Boolean(examId),
  })
}

export function useCreateTestPaper() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ examId, data }: { examId: string; data: TestPaperCreatePayload }) =>
      testPapersApi.createForExam(examId, data),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: testPaperKeys.forExam(variables.examId) }),
  })
}

export function useAddQuestionsToPaper() {
  return useMutation({
    mutationFn: ({ paperId, items }: { paperId: string; items: TestPaperQuestionAddItem[] }) =>
      testPapersApi.addQuestions(paperId, items),
  })
}
