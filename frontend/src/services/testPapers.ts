import { api } from './api'
import type {
  TestPaper,
  TestPaperCreatePayload,
  TestPaperQuestionAddItem,
} from '@/types/testPaper'

export const testPapersApi = {
  listForExam: (examId: string) =>
    api.get<TestPaper[]>(`/api/exams/${examId}/test-papers`).then((r) => r.data),

  createForExam: (examId: string, data: TestPaperCreatePayload) =>
    api.post<TestPaper>(`/api/exams/${examId}/test-papers`, data).then((r) => r.data),

  addQuestions: (paperId: string, items: TestPaperQuestionAddItem[]) =>
    api
      .post<{ added: number }>(`/api/test-papers/${paperId}/questions`, { question_ids: items })
      .then((r) => r.data),
}
