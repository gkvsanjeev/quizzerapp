import { api } from './api'
import type {
  Document,
  GenerateQuestionsPayload,
  GeneratedQuestion,
  SaveQuestionsPayload,
  SaveQuestionsResult,
  SearchResult,
} from '@/types/rag'

export const ragApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ document_id: string; status: string }>('/api/rag/upload', formData).then((r) => r.data)
  },

  listDocuments: () =>
    api.get<Document[]>('/api/rag/documents').then((r) => r.data),

  getDocument: (documentId: string) =>
    api.get<Document>(`/api/rag/documents/${documentId}`).then((r) => r.data),

  generateQuestions: (data: GenerateQuestionsPayload) =>
    api.post<GeneratedQuestion[]>('/api/rag/generate-questions', data).then((r) => r.data),

  saveQuestions: (data: SaveQuestionsPayload) =>
    api.post<SaveQuestionsResult>('/api/rag/questions/save', data).then((r) => r.data),

  search: (query: string, documentId?: string, limit = 5) =>
    api
      .get<SearchResult>('/api/rag/search', {
        params: { query, document_id: documentId, limit },
      })
      .then((r) => r.data),
}
