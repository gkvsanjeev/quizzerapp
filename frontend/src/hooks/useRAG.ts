import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ragApi } from '@/services/rag'
import type { GenerateQuestionsPayload, SaveQuestionsPayload } from '@/types/rag'

export const ragKeys = {
  all: ['rag'] as const,
  documents: () => ['rag', 'documents'] as const,
  document: (id: string) => ['rag', 'documents', id] as const,
}

export function useDocuments() {
  return useQuery({
    queryKey: ragKeys.documents(),
    queryFn: () => ragApi.listDocuments(),
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.some(
        (d) => d.processing_status === 'pending' || d.processing_status === 'processing',
      )
      return hasProcessing ? 3000 : false
    },
  })
}

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: ragKeys.document(documentId),
    queryFn: () => ragApi.getDocument(documentId),
    enabled: !!documentId,
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => ragApi.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ragKeys.documents() }),
  })
}

export function useGenerateQuestions() {
  return useMutation({
    mutationFn: (data: GenerateQuestionsPayload) => ragApi.generateQuestions(data),
  })
}

export function useSaveQuestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SaveQuestionsPayload) => ragApi.saveQuestions(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] })
    },
  })
}
