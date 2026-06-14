import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { examsApi, type ExamListParams } from '@/services/exams'
import type { ExamCreatePayload, ExamUpdatePayload, SubjectCreatePayload } from '@/types/exam'

export const examKeys = {
  all: ['exams'] as const,
  list: (params: ExamListParams) => ['exams', 'list', params] as const,
  detail: (id: string) => ['exams', 'detail', id] as const,
  subjects: (examId: string) => ['exams', examId, 'subjects'] as const,
}

export function useExams(params: ExamListParams = {}) {
  return useQuery({
    queryKey: examKeys.list(params),
    queryFn: () => examsApi.list(params),
  })
}

export function useCreateExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExamCreatePayload) => examsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.all }),
  })
}

export function useUpdateExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ examId, data }: { examId: string; data: ExamUpdatePayload }) =>
      examsApi.update(examId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.all }),
  })
}

export function useExamSubjects(examId: string | undefined) {
  return useQuery({
    queryKey: examKeys.subjects(examId ?? ''),
    queryFn: () => examsApi.listSubjects(examId as string),
    enabled: Boolean(examId),
  })
}

/**
 * Aggregates subjects across all of the teacher's exams into a
 * `subjectId → subjectName` map. Useful where only a `subject_id` is known
 * (e.g. the question bank table) since the API has no global subjects endpoint.
 */
export function useSubjectNameMap(): Map<string, string> {
  const { data: examsData } = useExams()
  const exams = examsData?.items ?? []

  const results = useQueries({
    queries: exams.map((exam) => ({
      queryKey: examKeys.subjects(exam.id),
      queryFn: () => examsApi.listSubjects(exam.id),
      staleTime: 60_000,
    })),
  })

  const map = new Map<string, string>()
  for (const result of results) {
    for (const subject of result.data ?? []) {
      map.set(subject.id, subject.name)
    }
  }
  return map
}

export function useCreateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ examId, data }: { examId: string; data: SubjectCreatePayload }) =>
      examsApi.createSubject(examId, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: examKeys.subjects(variables.examId) })
      qc.invalidateQueries({ queryKey: examKeys.all })
    },
  })
}
