import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import { usePerformance } from '@/hooks/useAnalysis'
import type { SubjectPerformance } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function fmtNullable(value: number | null, decimals = 0): string {
  if (value === null) return '—'
  return decimals > 0 ? value.toFixed(decimals) : String(value)
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

interface SummaryTableProps {
  subjects: SubjectPerformance[]
}

function SummaryTable({ subjects }: SummaryTableProps) {
  return (
    <div className="mt-6 overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Subject</th>
            <th className="px-4 py-3 text-right font-medium">Your Score</th>
            <th className="px-4 py-3 text-right font-medium">Max Score</th>
            <th className="px-4 py-3 text-right font-medium">%</th>
            <th className="px-4 py-3 text-right font-medium">Topper</th>
            <th className="px-4 py-3 text-right font-medium">Average</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {subjects.map((subject) => (
            <tr key={subject.name} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{subject.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{subject.score}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {subject.max_score}
              </td>
              <td className="px-4 py-3 text-right">
                <Badge variant="secondary" className="text-xs">
                  {subject.percentage.toFixed(1)}%
                </Badge>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {fmtNullable(subject.topper_score)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {fmtNullable(subject.average_score, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PerformanceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading performance data">
      {/* Chart skeleton */}
      <Skeleton className="h-80 w-full rounded-lg" />

      {/* Table skeleton */}
      <div className="mt-6 overflow-hidden rounded-md border">
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data renderer
// ---------------------------------------------------------------------------

interface PerformanceDataProps {
  data: SubjectPerformance[]
}

function PerformanceData({ data }: PerformanceDataProps) {
  // Transform data for Recharts: each subject as a data point
  const chartData = data.map((s) => ({
    name: s.name,
    'Your Score': s.score,
    'Topper Score': s.topper_score ?? 0,
    'Average Score': s.average_score ?? 0,
  }))

  // Determine max Y value for proper scaling
  const maxScore = Math.max(
    ...data.flatMap((s) => [s.score, s.topper_score ?? 0, s.average_score ?? 0])
  )
  const yDomain = [0, Math.ceil(maxScore / 10) * 10 || 100]

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Subject Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => v}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(value: number) => [value, '']}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar
                  dataKey="Your Score"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Topper Score"
                  fill="hsl(var(--success, #22c55e))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Average Score"
                  fill="hsl(var(--muted))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary table */}
      <SummaryTable subjects={data} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface PerformanceSectionProps {
  attemptId: string | undefined
}

export function PerformanceSection({ attemptId }: PerformanceSectionProps) {
  const { data, isLoading, isError } = usePerformance(attemptId)

  if (isLoading) {
    return <PerformanceSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load performance data. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || data.subjects.length === 0) {
    return (
      <Alert className="max-w-xl">
        <AlertDescription>
          No performance data available for this attempt.
        </AlertDescription>
      </Alert>
    )
  }

  return <PerformanceData data={data.subjects} />
}