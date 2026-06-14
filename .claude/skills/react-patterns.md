# React Patterns — QuizzerApp

## Project Conventions

- All components in `components/` are presentational — they receive props, emit events, no API calls
- Pages in `pages/` own data-fetching logic via TanStack Query hooks
- Custom hooks in `hooks/` encapsulate query/mutation logic for a domain
- No `any` type — use explicit interfaces from `types/`

## API Client Pattern

```typescript
// services/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// Attach access token from memory (not localStorage)
let accessToken: string | null = null
export const setAccessToken = (t: string | null) => { accessToken = t }

api.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  r => r,
  async error => {
    if (error.response?.status === 401) {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
      setAccessToken(data.access_token)
      return api(error.config)  // retry original request
    }
    return Promise.reject(error)
  }
)
```

## TanStack Query Hook Pattern

```typescript
// hooks/useAnalysis.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { OverviewData } from '@/types/analysis'

export function useAnalysisOverview(attemptId: string) {
  return useQuery<OverviewData>({
    queryKey: ['analysis', attemptId, 'overview'],
    queryFn: () => api.get(`/api/analysis/${attemptId}/overview`).then(r => r.data),
    staleTime: 1000 * 60 * 5,  // cache for 5 minutes (analysis data doesn't change)
  })
}
```

## Zustand Store Pattern

```typescript
// store/examSessionStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface ExamSession {
  attemptId: string | null
  currentQuestionIndex: number
  localAnswers: Record<string, string>  // questionId → optionId
  markedForReview: Set<string>
  timeElapsedSeconds: number
  setAnswer: (questionId: string, optionId: string) => void
  clearAnswer: (questionId: string) => void
  nextQuestion: () => void
  reset: () => void
}

export const useExamSession = create<ExamSession>()(
  persist(
    (set) => ({
      attemptId: null,
      currentQuestionIndex: 0,
      localAnswers: {},
      markedForReview: new Set(),
      timeElapsedSeconds: 0,
      setAnswer: (qId, oId) => set(s => ({ localAnswers: { ...s.localAnswers, [qId]: oId } })),
      clearAnswer: (qId) => set(s => { const a = { ...s.localAnswers }; delete a[qId]; return { localAnswers: a } }),
      nextQuestion: () => set(s => ({ currentQuestionIndex: s.currentQuestionIndex + 1 })),
      reset: () => set({ attemptId: null, currentQuestionIndex: 0, localAnswers: {}, timeElapsedSeconds: 0 }),
    }),
    { name: 'exam-session', storage: createJSONStorage(() => sessionStorage) }
  )
)
```

## Page Pattern (data-fetching)

```typescript
// pages/analysis/AnalysisPage.tsx
export function AnalysisPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const [activeSection, setActiveSection] = useState('overview')

  return (
    <div className="flex h-screen">
      <AnalysisSidebar active={activeSection} onChange={setActiveSection} />
      <main className="flex-1 overflow-y-auto p-6">
        {activeSection === 'overview' && <OverviewSection attemptId={attemptId!} />}
        {activeSection === 'performance' && <PerformanceSection attemptId={attemptId!} />}
        {/* ... */}
      </main>
    </div>
  )
}
```

## Analysis Section Component Pattern

```typescript
// components/analysis/OverviewSection.tsx
import { useAnalysisOverview } from '@/hooks/useAnalysis'

interface Props { attemptId: string }

export function OverviewSection({ attemptId }: Props) {
  const { data, isLoading, error } = useAnalysisOverview(attemptId)

  if (isLoading) return <SectionSkeleton />
  if (error) return <ErrorMessage error={error} />

  return (
    <div className="space-y-6">
      <ScoreCard score={data.score} maxScore={data.max_score} rank={data.rank} percentile={data.percentile} />
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Accuracy" value={`${data.accuracy_percentage}%`} />
        <StatCard label="Attempted" value={`${data.attempted}/${data.total_questions}`} />
        <StatCard label="Time Taken" value={formatDuration(data.time_taken_seconds)} />
      </div>
    </div>
  )
}
```

## Chart Component Pattern

```typescript
// components/charts/SubjectPerformanceChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface SubjectPerf { name: string; score: number; max_score: number; topper_score: number }
interface Props { data: SubjectPerf[] }

export function SubjectPerformanceChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="score" fill="#4F46E5" name="Your Score" />
        <Bar dataKey="topper_score" fill="#10B981" name="Topper Score" />
        <Bar dataKey="max_score" fill="#E5E7EB" name="Max Score" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

## Exam Interface — Timer Hook

```typescript
// hooks/useExamTimer.ts
import { useEffect } from 'react'
import { useExamSession } from '@/store/examSessionStore'

export function useExamTimer(durationSeconds: number, onExpiry: () => void) {
  const { timeElapsedSeconds } = useExamSession()
  const remaining = durationSeconds - timeElapsedSeconds

  useEffect(() => {
    const interval = setInterval(() => {
      useExamSession.setState(s => ({ timeElapsedSeconds: s.timeElapsedSeconds + 1 }))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (remaining <= 0) onExpiry()
  }, [remaining, onExpiry])

  return { remaining, formatted: formatDuration(Math.max(0, remaining)) }
}
```

## Route Configuration (React Router v6)

```typescript
// main.tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/exam/:testPaperId" element={<ExamPage />} />
    <Route path="/analysis/:attemptId" element={<AnalysisPage />} />
    <Route path="/rag" element={<RAGPage />} />
  </Route>
</Routes>
```

## Type Definitions Location

All API response types in `types/`:
- `types/auth.ts` — `User`, `TokenOut`
- `types/exam.ts` — `Exam`, `Subject`, `Topic`, `TestPaper`
- `types/question.ts` — `Question`, `Option`
- `types/attempt.ts` — `AttemptState`, `AttemptResult`
- `types/analysis.ts` — `OverviewData`, `PerformanceData`, etc.
- `types/rag.ts` — `Document`, `GeneratedQuestion`
