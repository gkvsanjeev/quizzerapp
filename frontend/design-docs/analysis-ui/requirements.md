# Analysis UI Requirements
## T045 — AnalysisPage + T046 — OverviewSection

---

## Feature Name

Post-Exam Analytics Dashboard — tabbed analytics page for a submitted exam attempt,
accessible at `/analysis/:attemptId`, with the Overview section implemented in T046 and
seven placeholder sections for T047–T053.

---

## Project Constraints (binding)

- React 18 + Vite 5 SPA, TypeScript strict (no `any`).
- No Next.js — no RSC, no `"use client"`, no `next/*` imports.
- Routing: react-router-dom v6 (`useParams` for `:attemptId`).
- Server state: TanStack Query v5 (`useQuery` with `staleTime: 5 * 60 * 1000` — analysis
  data is immutable once an attempt is submitted).
- Charts: Recharts (`recharts@^2`) — already a project dependency. Recharts is NOT a
  shadcn component; it is imported directly from `recharts`.
- Path aliases: `@/components/ui`, `@/hooks`, `@/types`, `@/components`, `@/services`,
  `@/store`, `@/lib`.

---

## T045 — AnalysisPage

### File
`frontend/src/pages/analysis/AnalysisPage.tsx`

### Route
`/analysis/:attemptId` — wrapped in `<PrivateRoute>` inside `App.tsx`.

```
// App.tsx addition (inside <Routes>)
<Route
  path="/analysis/:attemptId"
  element={
    <PrivateRoute>
      <AnalysisPage />
    </PrivateRoute>
  }
/>
```

### Components Required

| Component | Source | Status | Purpose |
|---|---|---|---|
| `TeacherPageShell` | `@/components/teacher/TeacherPageShell` | Already installed | Outer chrome — top nav, sign-out, `max-w-6xl` content area. Accepts `title`, `description`, `action` props. Students already use this shell (see `AttemptsPage`). |
| `Tabs` | `@/components/ui/tabs` | **NEW — install** | Root tab container. |
| `TabsList` | `@/components/ui/tabs` | **NEW — install** | Horizontal pill/underline tab bar. |
| `TabsTrigger` | `@/components/ui/tabs` | **NEW — install** | Individual tab button (one per section). |
| `TabsContent` | `@/components/ui/tabs` | **NEW — install** | Lazy-rendered panel per tab. |
| `Button` | `@/components/ui/button` | Already installed | "Back to attempts" link button (`variant="ghost"`, `asChild` with `<Link>`). |
| `Badge` | `@/components/ui/badge` | Already installed | Score summary chip in the page header (e.g. "72 / 100"). |
| `Skeleton` | `@/components/ui/skeleton` | Already installed | Loading placeholder for the page-header score summary while `useOverview` resolves. |
| `OverviewSection` | `@/components/analysis/OverviewSection` | T046 (new) | Content of the Overview tab. |
| `ComingSoonPlaceholder` | inline or `@/components/analysis/ComingSoonPlaceholder` | New — trivial | Renders for tabs T047–T053 so they don't break. |
| `useOverview` | `@/hooks/useAnalysis` | Already built | Fetches overview data used in the page-header score summary. |
| `useParams` | `react-router-dom` | Installed | Extracts `attemptId` from the URL. |
| `Link` | `react-router-dom` | Installed | Back-navigation to `/attempts`. |

### Tab Definitions

```
value="overview"          label="Overview"          component=<OverviewSection>
value="performance"       label="Performance"       component=<ComingSoonPlaceholder> (T047)
value="time"              label="Time"              component=<ComingSoonPlaceholder> (T048)
value="attempts"          label="Attempts"          component=<ComingSoonPlaceholder> (T049)
value="difficulty"        label="Difficulty"        component=<ComingSoonPlaceholder> (T050)
value="subject-movement"  label="Subject Movement"  component=<ComingSoonPlaceholder> (T051)
value="question-journey"  label="Question Journey"  component=<ComingSoonPlaceholder> (T052)
value="questions"         label="Questions"         component=<ComingSoonPlaceholder> (T053)
```

Default active tab: `"overview"`.

### Component Hierarchy

```
AnalysisPage  (pages/analysis/AnalysisPage.tsx)
└── TeacherPageShell  [title, description, action]
    ├── action slot
    │   └── Button (ghost, asChild)
    │       └── Link to="/attempts"  "← Back to Attempts"
    ├── [page header — title slot]
    │   "Exam Analysis"  +  description = test paper title or skeleton
    └── main content
        ├── [score summary strip — above tabs]
        │   ├── Badge  "Score: {score} / {max_score}"  (or Skeleton while loading)
        │   └── Badge  "{percentage}%"  (or Skeleton while loading)
        └── Tabs  [defaultValue="overview"]
            ├── TabsList  [8 triggers, horizontal scroll on mobile]
            │   ├── TabsTrigger value="overview"         "Overview"
            │   ├── TabsTrigger value="performance"      "Performance"
            │   ├── TabsTrigger value="time"             "Time"
            │   ├── TabsTrigger value="attempts"         "Attempts"
            │   ├── TabsTrigger value="difficulty"       "Difficulty"
            │   ├── TabsTrigger value="subject-movement" "Subject Movement"
            │   ├── TabsTrigger value="question-journey" "Question Journey"
            │   └── TabsTrigger value="questions"        "Questions"
            ├── TabsContent value="overview"
            │   └── OverviewSection  [attemptId]
            ├── TabsContent value="performance"
            │   └── ComingSoonPlaceholder  label="Performance"
            ├── TabsContent value="time"
            │   └── ComingSoonPlaceholder  label="Time Analysis"
            ├── TabsContent value="attempts"
            │   └── ComingSoonPlaceholder  label="Attempts Breakdown"
            ├── TabsContent value="difficulty"
            │   └── ComingSoonPlaceholder  label="Difficulty Breakdown"
            ├── TabsContent value="subject-movement"
            │   └── ComingSoonPlaceholder  label="Subject Movement"
            ├── TabsContent value="question-journey"
            │   └── ComingSoonPlaceholder  label="Question Journey"
            └── TabsContent value="questions"
                └── ComingSoonPlaceholder  label="Questions"
```

### Data Flow

```
URL param :attemptId  (useParams)
    │
    └── useOverview(attemptId)    [TQ, staleTime 5 min]
            │
            ├── isLoading  → Skeleton in score strip + description
            ├── isError    → silent (error surfaced inside OverviewSection)
            └── data       → Badge "score / max_score", Badge "percentage%"
                             + description = test paper name if available
```

Note: `AnalysisPage` calls `useOverview` only to populate the header summary strip.
`OverviewSection` calls it independently — TQ deduplicates the network request via the
shared query key `['analysis', attemptId, 'overview']`.

### Implementation Notes

- `TeacherPageShell` is appropriate here: students already see it on `AttemptsPage`,
  so there is no role-gating concern. The nav items shown are filtered by role in the
  shell itself.
- The `TabsList` must be horizontally scrollable on small viewports. Wrap it in a
  `ScrollArea` (already installed) with `orientation="horizontal"`, or apply
  `overflow-x-auto` directly — both are acceptable. Eight tabs will overflow on mobile.
- `TabsContent` panels are lazy in the sense that Radix `Tabs` does not mount hidden
  panels by default (unless `forceMount` is passed — do NOT pass `forceMount`). This
  means each section's TQ hook only fires when its tab is first activated. This is the
  desired behavior.
- `ComingSoonPlaceholder` is a trivial component (a centred div with muted text and a
  `Construction` icon from lucide-react). It carries no state or data-fetching.
- The route `/analysis/:attemptId` must be registered in `App.tsx` alongside the
  existing `/exam/:attemptId` route.

### Accessibility

- `Tabs` from shadcn/Radix implements the ARIA `tablist` / `tab` / `tabpanel` pattern
  automatically. No manual `role` or `aria-selected` attributes needed.
- The "Back to Attempts" Button must have visible label text (not icon-only).
- Score summary Badges are decorative; wrap the strip in a `<section aria-label="Score summary">`.
- Page `<h1>` is provided by `TeacherPageShell`'s `title` prop.

---

## T046 — OverviewSection

### File
`frontend/src/components/analysis/OverviewSection.tsx`

### Props
```typescript
interface OverviewSectionProps {
  attemptId: string
}
```

### Components Required

| Component | Source | Status | Purpose |
|---|---|---|---|
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@/components/ui/card` | Already installed | KPI card shells and benchmark card. |
| `Skeleton` | `@/components/ui/skeleton` | Already installed | Loading placeholders for all KPI values and the gauge. |
| `Alert`, `AlertDescription` | `@/components/ui/alert` | Already installed | Error state (`variant="destructive"`). |
| `Separator` | `@/components/ui/separator` | Already installed | Visual divider between benchmark columns. |
| `Badge` | `@/components/ui/badge` | Already installed | Accuracy % badge with color-coded variant (green/yellow/red). |
| `Progress` | `@/components/ui/progress` | Already installed | Optional linear bar under the gauge for at-a-glance percentage (secondary to the radial chart). |
| `RadialBarChart`, `RadialBar`, `PolarAngleAxis`, `ResponsiveContainer`, `Tooltip` | `recharts` | Already installed (project dep) | Radial gauge showing score percentage (0–100). |
| `useOverview` | `@/hooks/useAnalysis` | Already built | Primary data hook for this section. |

No new shadcn components are required for T046.

### Component Hierarchy

```
OverviewSection  (components/analysis/OverviewSection.tsx)
│
├── [Loading branch — isLoading]
│   └── KPI Skeleton grid  (9 × Skeleton cards)
│       + Gauge Skeleton  (Skeleton circle)
│       + Benchmark Skeleton  (Skeleton card)
│
├── [Error branch — isError]
│   └── Alert variant="destructive"
│       └── AlertDescription  "Failed to load overview. Please refresh."
│
└── [Data branch — data exists]
    ├── KPI Grid  (responsive: 2 cols mobile → 3 cols md → 4 cols lg)
    │   ├── KpiCard  label="Score"        value="{score} / {max_score}"
    │   ├── KpiCard  label="Percentage"   value="{percentage}%"
    │   ├── KpiCard  label="Rank"         value="{rank ?? '—'}"
    │   ├── KpiCard  label="Percentile"   value="{percentile !== null ? `${percentile.toFixed(1)}%` : '—'}"
    │   ├── KpiCard  label="Accuracy"     value="{accuracy_percentage}%"  [+ Badge variant]
    │   ├── KpiCard  label="Time Taken"   value="{formatDuration(time_taken_seconds)}"
    │   ├── KpiCard  label="Attempted"    value="{attempted} / {total_questions}"
    │   ├── KpiCard  label="Correct"      value="{correct}"
    │   ├── KpiCard  label="Incorrect"    value="{incorrect}"
    │   └── KpiCard  label="Unattempted"  value="{unattempted}"
    │
    ├── Score Gauge  (Card, full-width or 50% on md+)
    │   └── ResponsiveContainer  height=260
    │       └── RadialBarChart
    │           ├── PolarAngleAxis  type="number" domain={[0, 100]} tick={false}
    │           ├── RadialBar
    │           │   dataKey="percentage"
    │           │   data={[{ percentage: data.percentage, fill: gaugeColor }]}
    │           │   cornerRadius={8}
    │           │   background={{ fill: "hsl(var(--muted))" }}
    │           └── Tooltip  [shows percentage label]
    │       + center label overlay  (absolute-positioned div)
    │           "{percentage}%"  +  "Score"  subtitle
    │
    └── Benchmark Card  (Card, full-width or 50% on md+)
        └── CardHeader + CardTitle "Score Comparison"
            └── CardContent
                └── 3-column benchmark row  (flex, Separator between cols)
                    ├── BenchmarkCol  label="Your Score"    value="{score}"    highlight=true
                    ├── BenchmarkCol  label="Topper Score"  value="{topper_score ?? '—'}"
                    └── BenchmarkCol  label="Average Score" value="{average_score !== null ? average_score.toFixed(1) : '—'}"
```

`KpiCard` is a small internal sub-component (not a separate file) — a `Card` with
`CardHeader`/`CardTitle` for the label and `CardContent` for the value. It accepts
`label: string`, `value: string`, and an optional `children` slot for the accuracy Badge.

`BenchmarkCol` is also an internal sub-component — a `div` with centred text showing
label + value, optionally highlighted with `text-primary font-bold`.

### Data Flow

```
attemptId (prop)
    │
    └── useOverview(attemptId)   [TQ query key: ['analysis', attemptId, 'overview']]
            │
            ├── isLoading → render Skeleton grid (no data yet)
            ├── isError   → render destructive Alert
            └── data: Overview → destructure all fields, render KPI grid + gauge + benchmark

Overview shape (from @/types/analysis):
  score, max_score, percentage, rank | null, percentile | null,
  total_questions, attempted, correct, incorrect, unattempted,
  accuracy_percentage, time_taken_seconds, duration_seconds,
  topper_score | null, average_score | null
```

### Recharts Usage Notes

Recharts is the charting library (not a shadcn component). It is imported directly:

```typescript
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
```

**RadialBarChart configuration:**

- `innerRadius="70%"` / `outerRadius="90%"` — creates a thick arc gauge ring.
- `startAngle={180}` / `endAngle={0}` — renders as a top semicircle (common gauge
  pattern). Alternatively `startAngle={90}` / `endAngle={-270}` for a full-circle gauge.
  Full circle is recommended for a cleaner analytics aesthetic.
- `data` is a single-element array: `[{ name: 'Score', percentage: data.percentage }]`.
- `PolarAngleAxis` domain `[0, 100]` with `tick={false}` hides the degree labels.
- `background` prop on `RadialBar` fills the track in `hsl(var(--muted))`.
- Gauge color: derive from percentage — green (`hsl(var(--chart-2))` or Tailwind
  `#22c55e`) for >= 60%, amber for 40–59%, red for < 40%. Store thresholds as constants.
- The percentage label in the center is a `<div>` absolutely positioned over the
  `ResponsiveContainer` using a wrapper `div` with `position: relative`. Recharts does
  not provide a built-in center label for `RadialBarChart`.
- `ResponsiveContainer` must have an explicit `height` (e.g. `260`) — it cannot infer
  height from a flex parent alone.

### Helper Functions (internal to OverviewSection.tsx)

```typescript
// Format seconds → "1h 23m" or "45:30" (mm:ss for < 1 hour)
function formatDuration(seconds: number): string

// Derive gauge fill color from percentage
function gaugeColor(percentage: number): string

// Format nullable number to fixed decimal or em-dash
function fmtNullable(value: number | null, decimals = 0): string
```

All three are pure functions with no side effects — define them at module scope within
`OverviewSection.tsx`.

### State Management

No Zustand store usage. All state is server state via TanStack Query. No local
`useState` is needed in T046 — the component is fully derived from the query result.

### Validation Rules and Null Handling

| Field | Null strategy |
|---|---|
| `rank` | Display `"—"` (em dash). Do NOT show "0" or "N/A". |
| `percentile` | Display `"—"`. When present, format to one decimal place: `${percentile.toFixed(1)}%`. |
| `topper_score` | Display `"—"` in benchmark column. |
| `average_score` | Display `"—"` in benchmark column. When present, format to one decimal place. |
| `percentage` | Always present (not nullable). Safe to use directly for gauge data. |

### Skeleton Loading Layout

While `isLoading`:
- Render 10 `Skeleton` boxes in the same grid layout as the KPI cards
  (`className="h-20 w-full rounded-lg"`).
- Render a circular `Skeleton` in place of the gauge
  (`className="h-64 w-64 rounded-full mx-auto"`).
- Render a `Skeleton` card in place of the benchmark
  (`className="h-24 w-full rounded-lg"`).

This ensures zero layout shift when data arrives.

### Accessibility

- KPI grid uses `<dl>` / `<dt>` / `<dd>` semantics: each `KpiCard` renders a `<dt>`
  for the label and `<dd>` for the value. The `Card` wrapper is presentational.
- The gauge `ResponsiveContainer` must have `role="img"` and
  `aria-label="Score gauge: {percentage}%"` on its wrapper `<div>`.
- The benchmark card heading ("Score Comparison") is a `CardTitle` rendered as `<h3>`,
  consistent with the shadcn Card convention.
- Skeleton containers must carry `aria-hidden="true"` and the parent must carry
  `aria-busy="true"` while loading.
- Error Alert must be the first focusable element when `isError` is true — place it
  above the grid, not at the bottom.

---

## Consolidated Component Install List

### New shadcn components to install (not yet in the project)

| Component | Install Command |
|---|---|
| `tabs` | `npx shadcn@latest add @shadcn/tabs` |

That is the only new shadcn primitive required across both T045 and T046.

### Already-installed shadcn components used (no install needed)

`button`, `card`, `badge`, `skeleton`, `alert`, `separator`, `progress`,
`scroll-area`, `tooltip`

### Non-shadcn dependencies used

| Library | Import path | Already in project |
|---|---|---|
| Recharts | `recharts` | Yes — `recharts@^2` in package.json |
| react-router-dom | `react-router-dom` | Yes |
| lucide-react | `lucide-react` | Yes |
| TanStack Query v5 | `@tanstack/react-query` | Yes |

---

## File Checklist

```
frontend/src/
├── pages/
│   └── analysis/
│       └── AnalysisPage.tsx          ← T045 (new file)
├── components/
│   └── analysis/
│       ├── OverviewSection.tsx       ← T046 (new file)
│       └── ComingSoonPlaceholder.tsx ← T045 support (new, trivial)
└── App.tsx                           ← add /analysis/:attemptId route (edit existing)
```

No new hooks, services, or types files are needed for T045 or T046 — the full data
layer (`useAnalysis.ts`, `analysis.ts`, `@/types/analysis`) is already built.
