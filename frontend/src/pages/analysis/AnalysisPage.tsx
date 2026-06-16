import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { TeacherPageShell } from '@/components/teacher/TeacherPageShell'
import { OverviewSection } from '@/components/analysis/OverviewSection'
import { PerformanceSection } from '@/components/analysis/PerformanceSection'
import { TimeSection } from '@/components/analysis/TimeSection'
import { AttemptsSection } from '@/components/analysis/AttemptsSection'
import { ComingSoonPlaceholder } from '@/components/analysis/ComingSoonPlaceholder'
import { useOverview } from '@/hooks/useAnalysis'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'performance', label: 'Performance' },
  { value: 'time', label: 'Time' },
  { value: 'attempts', label: 'Attempts' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'subject-movement', label: 'Subject Movement' },
  { value: 'question-journey', label: 'Question Journey' },
  { value: 'questions', label: 'Questions' },
] as const

// ---------------------------------------------------------------------------
// ScoreSummaryStrip — header badges populated from useOverview
// ---------------------------------------------------------------------------

interface ScoreSummaryStripProps {
  attemptId: string
}

function ScoreSummaryStrip({ attemptId }: ScoreSummaryStripProps) {
  const { data, isLoading } = useOverview(attemptId)

  if (isLoading) {
    return (
      <section
        aria-label="Score summary"
        className="mb-4 flex items-center gap-3"
        aria-busy="true"
      >
        <Skeleton className="h-6 w-28 rounded-full" aria-hidden="true" />
        <Skeleton className="h-6 w-16 rounded-full" aria-hidden="true" />
      </section>
    )
  }

  if (!data) return null

  return (
    <section aria-label="Score summary" className="mb-4 flex items-center gap-3">
      <Badge variant="secondary" className="text-sm font-medium">
        Score: {data.score} / {data.max_score}
      </Badge>
      <Badge variant="outline" className="text-sm font-medium">
        {data.percentage}%
      </Badge>
    </section>
  )
}

// ---------------------------------------------------------------------------
// AnalysisPage — default export
// ---------------------------------------------------------------------------

export default function AnalysisPage() {
  const { attemptId } = useParams<{ attemptId: string }>()

  // Guard: attemptId missing (route misconfiguration or direct navigation)
  if (!attemptId) {
    return (
      <TeacherPageShell
        title="Analysis"
        description="Detailed breakdown of your attempt"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/attempts">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Back to Attempts
            </Link>
          </Button>
        }
      >
        <Alert variant="destructive" className="max-w-xl">
          <AlertDescription>
            No attempt ID found in the URL.{' '}
            <Link to="/attempts" className="font-medium underline underline-offset-4">
              Go back to Attempts
            </Link>{' '}
            and select an attempt to analyse.
          </AlertDescription>
        </Alert>
      </TeacherPageShell>
    )
  }

  return (
    <TeacherPageShell
      title="Exam Analysis"
      description="Detailed breakdown of your attempt"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/attempts">
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Back to Attempts
          </Link>
        </Button>
      }
    >
      {/* Score summary strip — above the tabs */}
      <ScoreSummaryStrip attemptId={attemptId} />

      {/* Tab bar + panels */}
      <Tabs defaultValue="overview">
        {/* Horizontal scroll wrapper for narrow viewports */}
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex w-max gap-0.5">
            {TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value} className="whitespace-nowrap">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview panel — fully implemented (T046) */}
        <TabsContent value="overview" className="mt-4">
          <OverviewSection attemptId={attemptId} />
        </TabsContent>

        {/* Placeholder panels — T047–T053 */}
        <TabsContent value="performance" className="mt-4">
          <PerformanceSection attemptId={attemptId} />
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <TimeSection attemptId={attemptId} />
        </TabsContent>

        <TabsContent value="attempts" className="mt-4">
          <AttemptsSection attemptId={attemptId} />
        </TabsContent>

        <TabsContent value="difficulty" className="mt-4">
          <ComingSoonPlaceholder title="Difficulty Breakdown" />
        </TabsContent>

        <TabsContent value="subject-movement" className="mt-4">
          <ComingSoonPlaceholder title="Subject Movement" />
        </TabsContent>

        <TabsContent value="question-journey" className="mt-4">
          <ComingSoonPlaceholder title="Question Journey" />
        </TabsContent>

        <TabsContent value="questions" className="mt-4">
          <ComingSoonPlaceholder title="Questions" />
        </TabsContent>
      </Tabs>
    </TeacherPageShell>
  )
}
