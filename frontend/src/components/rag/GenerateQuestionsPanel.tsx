import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Brain, Check, Edit3, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useDocuments } from '@/hooks/useRAG'
import { useExams, useExamSubjects } from '@/hooks/useExams'
import { useGenerateQuestions, useSaveQuestions } from '@/hooks/useRAG'
import type {
  GeneratedOption,
  GeneratedQuestion,
} from '@/types/rag'

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const

interface InlineEditableQuestion extends GeneratedQuestion {
  localId: number
}

export function GenerateQuestionsPanel() {
  const [selectedDocId, setSelectedDocId] = useState('')
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState(5)
  const [questions, setQuestions] = useState<InlineEditableQuestion[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: docsData, isLoading: docsLoading } = useDocuments()
  const { data: examsData } = useExams()
  const { data: subjectsData, isLoading: subjectsLoading } = useExamSubjects(
    selectedExamId || undefined,
  )
  const generateQuestions = useGenerateQuestions()
  const saveQuestionsMut = useSaveQuestions()

  const documents = useMemo(() => docsData?.filter((d) => d.processing_status === 'ready') ?? [], [docsData])
  const exams = useMemo(() => examsData?.items ?? [], [examsData])
  const subjects = useMemo(() => subjectsData ?? [], [subjectsData])

  async function handleGenerate() {
    if (!selectedDocId || !selectedSubjectId) {
      toast.error('Select a document and subject first')
      return
    }

    try {
      const result = await generateQuestions.mutateAsync({
        document_id: selectedDocId,
        subject_id: selectedSubjectId,
        count: questionCount,
        difficulty: selectedDifficulty as 'easy' | 'medium' | 'hard',
      })
      setQuestions(
        result.map((q, i) => ({ ...q, localId: i })),
      )
      setEditingId(null)
      toast.success(`Generated ${result.length} questions`)
    } catch {
      toast.error('Failed to generate questions')
    }
  }

  function handleDeleteQuestion(localId: number) {
    setQuestions((prev) => prev.filter((q) => q.localId !== localId))
    if (editingId === localId) setEditingId(null)
  }

  function handleEditQuestion(localId: number) {
    setEditingId(editingId === localId ? null : localId)
  }

  function handleSaveEdit(localId: number, field: keyof GeneratedQuestion, value: string | GeneratedOption[]) {
    setQuestions((prev) =>
      prev.map((q) => (q.localId === localId ? { ...q, [field]: value } : q)),
    )
  }

  async function handleSaveApproved() {
    if (questions.length === 0) {
      toast.error('No questions to save')
      return
    }

    try {
      const result = await saveQuestionsMut.mutateAsync({
        subject_id: selectedSubjectId,
        questions: questions.map(({ localId: _, ...q }) => q),
      })
      toast.success(`Saved ${result.saved_count} questions to the bank`)
      setQuestions([])
    } catch {
      toast.error('Failed to save questions')
    }
  }

  const canGenerate = selectedDocId && selectedSubjectId && questionCount >= 1 && questionCount <= 20

  return (
    <div className="space-y-6">
      {/* Generation form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5" />
            Generate Questions with AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Document */}
            <div className="space-y-2">
              <Label htmlFor="gen-doc">Source Document</Label>
              <Select value={selectedDocId} onValueChange={setSelectedDocId} disabled={docsLoading}>
                <SelectTrigger id="gen-doc">
                  <SelectValue placeholder={docsLoading ? 'Loading…' : 'Pick a document'} />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exam */}
            <div className="space-y-2">
              <Label htmlFor="gen-exam">Exam</Label>
              <Select value={selectedExamId} onValueChange={(v) => { setSelectedExamId(v); setSelectedSubjectId('') }}>
                <SelectTrigger id="gen-exam">
                  <SelectValue placeholder="Pick an exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="gen-subject">Subject</Label>
              <Select
                value={selectedSubjectId}
                onValueChange={setSelectedSubjectId}
                disabled={!selectedExamId || subjectsLoading}
              >
                <SelectTrigger id="gen-subject">
                  <SelectValue
                    placeholder={
                      !selectedExamId ? 'Pick an exam first' : subjectsLoading ? 'Loading…' : 'Pick a subject'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subj) => (
                    <SelectItem key={subj.id} value={subj.id}>
                      {subj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label htmlFor="gen-difficulty">Difficulty</Label>
              <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                <SelectTrigger id="gen-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Count */}
            <div className="space-y-2">
              <Label htmlFor="gen-count">Number of Questions</Label>
              <Input
                id="gen-count"
                type="number"
                min={1}
                max={20}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              />
            </div>

            {/* Generate button */}
            <div className="flex items-end">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || generateQuestions.isPending}
                className="w-full gap-2"
              >
                {generateQuestions.isPending ? (
                  'Generating…'
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results panel */}
      {generateQuestions.isPending && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {questions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Generated Questions ({questions.length})
            </CardTitle>
            <Button onClick={handleSaveApproved} disabled={saveQuestionsMut.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveQuestionsMut.isPending ? 'Saving…' : 'Save Approved'}
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[600px] pr-4">
              <div className="space-y-6">
                {questions.map((q, index) => (
                  <div key={q.localId}>
                    {index > 0 && <Separator className="mb-6" />}
                    <div className="space-y-3">
                      {/* Question header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">
                            Question {index + 1}
                          </p>
                          {editingId === q.localId ? (
                            <Textarea
                              value={q.text}
                              onChange={(e) => handleSaveEdit(q.localId, 'text', e.target.value)}
                              rows={3}
                              className="resize-none"
                            />
                          ) : (
                            <p className="text-base font-medium">{q.text}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditQuestion(q.localId)}
                          >
                            {editingId === q.localId ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Edit3 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQuestion(q.localId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="ml-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {q.options.map((opt) => {
                          return (
                            <div
                              key={opt.option_key}
                              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                                opt.is_correct
                                  ? 'border-green-300 bg-green-50 text-green-800'
                                  : 'border-muted bg-background text-foreground'
                              }`}
                            >
                              {opt.is_correct && <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />}
                              <span className="w-5 shrink-0 font-medium">{opt.option_key}.</span>
                              {editingId === q.localId ? (
                                <div className="flex-1 space-y-1">
                                  <Input
                                    value={opt.text}
                                    onChange={(e) => {
                                      const newOptions = q.options.map((o) =>
                                        o.option_key === opt.option_key ? { ...o, text: e.target.value } : o,
                                      )
                                      handleSaveEdit(q.localId, 'options', newOptions)
                                    }}
                                    className="h-8 text-sm"
                                  />
                                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <input
                                      type="checkbox"
                                      checked={opt.is_correct}
                                      onChange={(e) => {
                                        const newOptions = q.options.map((o) => ({
                                          ...o,
                                          is_correct: o.option_key === opt.option_key ? e.target.checked : false,
                                        }))
                                        handleSaveEdit(q.localId, 'options', newOptions)
                                      }}
                                    />
                                    Correct answer
                                  </label>
                                </div>
                              ) : (
                                <span className={opt.is_correct ? 'font-medium' : ''}>
                                  {opt.text}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Explanation */}
                      <div className="ml-4 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Explanation:</p>
                        {editingId === q.localId ? (
                          <Textarea
                            value={q.explanation}
                            onChange={(e) => handleSaveEdit(q.localId, 'explanation', e.target.value)}
                            rows={2}
                            className="resize-none text-sm"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">{q.explanation}</p>
                        )}
                      </div>

                      {/* Save edit button */}
                      {editingId === q.localId && (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            className="gap-2"
                          >
                            <Check className="h-4 w-4" />
                            Done Editing
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-4 flex justify-end border-t pt-4">
              <Button onClick={handleSaveApproved} disabled={saveQuestionsMut.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {saveQuestionsMut.isPending ? 'Saving…' : 'Save All Approved Questions'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!generateQuestions.isPending && questions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">No questions generated yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a document, subject, and click Generate to create questions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
