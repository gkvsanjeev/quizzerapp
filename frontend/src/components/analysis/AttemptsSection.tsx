import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

import { useAttemptsBreakdown } from '@/hooks/useAnalysis'
import type { AttemptsBreakdown } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIE_COLORS = {
  correct: '#22c55e',
  incorrect: '#ef4444',
  skipped: '#f59e0b',
  unattempted: '#9ca3af',
  marked_for_review: '#8b5cf6',
} as const

const PIE_COLORS_ARRAY = [
  PIE_COLORS.correct,
  PIE_COLORS.incorrect,
  PIE_COLORS.skipped,
  PIE_COLORS.unattempted,
  PIE_COLORS.marked_for_review,
]

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function fmtScore(value: number | null): string {
  if (value === null) return '—'
  return value.toFixed(1)
}

// ---------------------------------------------------------------------------
// Pie Chart Component
// ---------------------------------------------------------------------------

interface QuestionStatusPieProps {
  data: AttemptsBreakdown
}

function QuestionStatusPie({ data }: QuestionStatusPieProps) {
  const pieData = useMemo(() => {
    const total = data.correct + data.incorrect + data.skipped + data.unattempted
    // Only include categories with non-zero values
    const items = [
      { name: 'Correct', value: data.correct, color: PIE_COLORS.correct },
      { name: 'Incorrect', value: data.incorrect, color: PIE_COLORS.incorrect },
      { name: 'Skipped', value: data.skipped, color: PIE_COLORS.skipped },
      { name: 'Unattempted', value: data.unattempted, color: PIE_COLORS.unattempted },
      { name: 'Marked for Review', value: data.marked_for_review, color: PIE_COLORS.marked_for_review },
    ].filter(item => item.value > 0)

    return items.map(item => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
    }))
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Question Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props) => [
                  `${value} (${props.payload.percentage}%)`,
                  name,
                ]}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Waterfall Chart Component
// ---------------------------------------------------------------------------

interface WaterfallChartProps {
  data: AttemptsBreakdown
}

function WaterfallChart({ data }: WaterfallChartProps) {
  const waterfallData = useMemo(() => {
    // Waterfall: gross_score → -negative_marks → net_score
    // For visualization: [gross_score, drop to (gross - negative), final (net)]
    return [
      { name: 'Gross Score', value: data.gross_score, fill: '#22c55e' },
      { name: 'Negative Marks', value: -data.negative_marks, fill: '#ef4444' },
      { name: 'Net Score', value: data.net_score, fill: '#3b82f6' },
    ]
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Score Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={waterfallData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                tickFormatter={(v) => v}
              />
              <Tooltip
                formatter={(value: number, name: string) => [value.toFixed(1), name]}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
              >
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score summary */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Gross</div>
            <div className="text-lg font-bold text-green-600">{fmtScore(data.gross_score)}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Negative</div>
            <div className="text-lg font-bold text-red-600">-{fmtScore(data.negative_marks)}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Net</div>
            <div className="text-lg font-bold text-blue-600">{fmtScore(data.net_score)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AttemptsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading attempts data">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data renderer
// ---------------------------------------------------------------------------

interface AttemptsDataProps {
  data: AttemptsBreakdown
}

function AttemptsData({ data }: AttemptsDataProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <QuestionStatusPie data={data} />
        <WaterfallChart data={data} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface AttemptsSectionProps {
  attemptId: string | undefined
}

export function AttemptsSection({ attemptId }: AttemptsSectionProps) {
  const { data, isLoading, isError } = useAttemptsBreakdown(attemptId)

  if (isLoading) {
    return <AttemptsSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load attempts analysis. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return (
      <Alert className="max-w-xl">
        <AlertDescription>No attempts data available for this attempt.</AlertDescription>
      </Alert>
    )
  }

  return <AttemptsData data={data} />
}