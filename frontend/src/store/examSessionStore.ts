import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AttemptState, QuestionStudent } from '@/types/attempt'

export type QuestionStatus = 'unanswered' | 'answered' | 'marked' | 'answered-marked'

interface SessionTestPaper {
  id: string
  title: string
  durationSeconds: number
  totalMarks: number
}

interface ExamSessionState {
  attemptId: string | null
  testPaper: SessionTestPaper | null
  questions: QuestionStudent[]
  currentIndex: number
  /** questionId → selected option id (null = visited but cleared). */
  localAnswers: Record<string, string | null>
  /** questionId → marked-for-review flag. */
  markedForReview: Record<string, boolean>
  timeElapsedSeconds: number
  isPaused: boolean

  // actions
  syncFromServer: (state: AttemptState) => void
  setAnswer: (questionId: string, optionId: string | null) => void
  markForReview: (questionId: string) => void
  nextQuestion: () => void
  prevQuestion: () => void
  goToQuestion: (index: number) => void
  tick: () => void
  setPaused: (paused: boolean) => void
  reset: () => void
}

const initialState = {
  attemptId: null,
  testPaper: null,
  questions: [] as QuestionStudent[],
  currentIndex: 0,
  localAnswers: {} as Record<string, string | null>,
  markedForReview: {} as Record<string, boolean>,
  timeElapsedSeconds: 0,
  isPaused: false,
}

export const useExamSessionStore = create<ExamSessionState>()(
  persist(
    (set) => ({
      ...initialState,

      syncFromServer: (state) =>
        set(() => {
          const localAnswers: Record<string, string | null> = {}
          const markedForReview: Record<string, boolean> = {}
          for (const [qid, a] of Object.entries(state.answers)) {
            localAnswers[qid] = a.selected_option_id
            if (a.is_marked_for_review) markedForReview[qid] = true
          }
          return {
            attemptId: state.attempt_id,
            testPaper: {
              id: state.test_paper.id,
              title: state.test_paper.title,
              durationSeconds: state.test_paper.duration_seconds,
              totalMarks: state.test_paper.total_marks,
            },
            questions: state.questions,
            currentIndex: 0,
            localAnswers,
            markedForReview,
            timeElapsedSeconds: state.time_elapsed_seconds,
            isPaused: false,
          }
        }),

      setAnswer: (questionId, optionId) =>
        set((s) => ({ localAnswers: { ...s.localAnswers, [questionId]: optionId } })),

      markForReview: (questionId) =>
        set((s) => ({
          markedForReview: {
            ...s.markedForReview,
            [questionId]: !s.markedForReview[questionId],
          },
        })),

      nextQuestion: () =>
        set((s) => ({ currentIndex: Math.min(s.questions.length - 1, s.currentIndex + 1) })),

      prevQuestion: () => set((s) => ({ currentIndex: Math.max(0, s.currentIndex - 1) })),

      goToQuestion: (index) =>
        set((s) => ({
          currentIndex: Math.max(0, Math.min(s.questions.length - 1, index)),
        })),

      tick: () => set((s) => (s.isPaused ? s : { timeElapsedSeconds: s.timeElapsedSeconds + 1 })),

      setPaused: (paused) => set({ isPaused: paused }),

      reset: () => set({ ...initialState }),
    }),
    {
      name: 'exam-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

/** Derive the palette status for a question. */
export function questionStatus(
  questionId: string,
  localAnswers: Record<string, string | null>,
  markedForReview: Record<string, boolean>,
): QuestionStatus {
  const answered = Boolean(localAnswers[questionId])
  const marked = Boolean(markedForReview[questionId])
  if (answered && marked) return 'answered-marked'
  if (marked) return 'marked'
  if (answered) return 'answered'
  return 'unanswered'
}
