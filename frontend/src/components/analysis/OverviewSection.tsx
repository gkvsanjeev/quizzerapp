import type { ReactNode } from 'react'
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import { useOverview } from '@/hooks/useAnalysis'
import type { Overview } from '@/types/analysis'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAUGE_RED = '#ef4444'
const GAUGE_AMBER = '#f59e0b'
const GAUGE_GREEN = '#22c55e'

const GAUGE_LOW_THRESHOLD = 40
const GAUGE_MID_THRESHOLD = 70

// ---------------------------------------------------------------------------
// Pure helper functions (module-scope, no side effects)
// ---------------------------------------------------------------------------

/**
 * Format a duration in seconds into a human-readable string.
 * Examples: 5400 → "1h 30m", 90 → "1m 30s", 45 → "45s"
 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  return `${s}s`
}

/**
 * Derive a gauge fill colour based on percentage thresholds.
 * < 40 → red, 40–69 → amber, >= 70 → green
 */
function gaugeColor(percentage: number): string {
  if (percentage < GAUGE_LOW_THRESHOLD) return GAUGE_RED
  if (percentage < GAUGE_MID_THRESHOLD) return GAUGE_AMBER
  return GAUGE_GREEN
}

/**
 * Format a nullable number as a string with optional decimal places.
 * Null renders as an em dash ("—"), never "0" or "N/A".
 */
function fmtNullable(value: number | null, decimals = 0): string {
  if (value === null) return '—'
  return decimals > 0 ? value.toFixed(decimals) : String(value)
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  /** Tailwind text-colour class for the value (defaults to text-foreground). */
  valueClassName?: string
  /** Optional content rendered below the value (e.g. an accuracy Badge). */
  children?: ReactNode
}

/**
 * KpiCard — a single metric tile using dl/dt/dd semantics inside a Card shell.
 */
function KpiCard({ label, value, valueClassName, children }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <dl>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd
            className={`mt-2 text-2xl font-bold tabular-nums ${valueClassName ?? 'text-foreground'}`}
          >
            {value}
          </dd>
          {children && <dd className="mt-1">{children}</dd>}
        </dl>
      </CardContent>
    </Card>
  )
}

interface BenchmarkColProps {
  label: string
  value: string
  highlight?: boolean
}

function BenchmarkCol({ label, value, highlight = false }: BenchmarkColProps) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-4 text-center">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          highlight
            ? 'text-xl font-bold text-primary tabular-nums'
            : 'text-xl font-semibold tabular-nums text-foreground'
        }
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loading layout
// ---------------------------------------------------------------------------

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview data">
      {/* KPI grid skeletons */}
      <div
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>

      {/* Gauge + benchmark skeletons */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-center" aria-hidden="true">
          <Skeleton className="h-64 w-64 rounded-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" aria-hidden="true" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accuracy badge variant helper
// ---------------------------------------------------------------------------

function accuracyBadgeVariant(
  accuracy: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (accuracy >= GAUGE_MID_THRESHOLD) return 'default'
  if (accuracy >= GAUGE_LOW_THRESHOLD) return 'secondary'
  return 'destructive'
}

// ---------------------------------------------------------------------------
// Data section — rendered when data is present
// ---------------------------------------------------------------------------

interface OverviewDataProps {
  data: Overview
}

function OverviewData({ data }: OverviewDataProps) {
  const fill = gaugeColor(data.percentage)
  const gaugeData = [{ name: 'Score', percentage: data.percentage, fill }]

  return (
    <div className="space-y-6">
      {/* KPI grid — 2 cols mobile → 3 cols md → 4 cols lg */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Score" value={`${data.score} / ${data.max_score}`} />

        <KpiCard label="Percentage" value={`${data.percentage}%`} />

        <KpiCard label="Rank" value={fmtNullable(data.rank)} />

        <KpiCard
          label="Percentile"
          value={data.percentile !== null ? `${data.percentile.toFixed(1)}%` : '—'}
        />

        <KpiCard label="Accuracy" value={`${data.accuracy_percentage}%`}>
          <Badge variant={accuracyBadgeVariant(data.accuracy_percentage)}>
            {data.accuracy_percentage >= GAUGE_MID_THRESHOLD
              ? 'High'
              : data.accuracy_percentage >= GAUGE_LOW_THRESHOLD
                ? 'Medium'
                : 'Low'}
          </Badge>
        </KpiCard>

        <KpiCard label="Time Taken" value={formatDuration(data.time_taken_seconds)} />

        <KpiCard
          label="Attempted"
          value={`${data.attempted} / ${data.total_questions}`}
        />

        <KpiCard
          label="Correct"
          value={String(data.correct)}
          valueClassName="text-green-600 dark:text-green-400"
        />

        <KpiCard
          label="Incorrect"
          value={String(data.incorrect)}
          valueClassName="text-destructive"
        />

        <KpiCard
          label="Unattempted"
          value={String(data.unattempted)}
          valueClassName="text-muted-foreground"
        />
      </div>

      {/* Gauge + benchmark row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Radial gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Score Gauge</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="relative"
              role="img"
              aria-label={`Score gauge: ${data.percentage}%`}
            >
              <ResponsiveContainer width="100%" height={260}>
                <RadialBarChart
                  innerRadius="70%"
                  outerRadius="90%"
                  startAngle={90}
                  endAngle={-270}
                  data={gaugeData}
                  barSize={20}
                >
                  <PolarAngleAxis
                    type="number"
                    domain={[0, 100]}
                    angleAxisId={0}
                    tick={false}
                  />
                  <RadialBar
                    dataKey="percentage"
                    angleAxisId={0}
                    cornerRadius={8}
                    background={{ fill: 'hsl(var(--muted))' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Score']}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              {/* Centered percentage label — absolutely positioned over the chart */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-3xl font-bold tabular-nums" style={{ color: fill }}>
                  {data.percentage}%
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Score
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benchmark card */}
        <Card className="self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Score Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <BenchmarkCol label="Your Score" value={String(data.score)} highlight />
              <Separator orientation="vertical" className="h-12 mx-2" />
              <BenchmarkCol
                label="Topper Score"
                value={fmtNullable(data.topper_score)}
              />
              <Separator orientation="vertical" className="h-12 mx-2" />
              <BenchmarkCol
                label="Average Score"
                value={fmtNullable(data.average_score, 1)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OverviewSection — public export
// ---------------------------------------------------------------------------

interface OverviewSectionProps {
  attemptId: string | undefined
}

export function OverviewSection({ attemptId }: OverviewSectionProps) {
  const { data, isLoading, isError } = useOverview(attemptId)

  if (isLoading) {
    return <OverviewSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertDescription>
          Failed to load overview. Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return null
  }

  return <OverviewData data={data} />
}
