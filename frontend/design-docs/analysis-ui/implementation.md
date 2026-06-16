# Analysis UI — Implementation Notes (T045 + T046)

## Files Created

| File | Task | Description |
|---|---|---|
| `src/pages/analysis/AnalysisPage.tsx` | T045 | Route page at `/analysis/:attemptId` |
| `src/components/analysis/OverviewSection.tsx` | T046 | Overview tab content with KPI cards + gauge |
| `src/components/analysis/ComingSoonPlaceholder.tsx` | T045 | Trivial placeholder for T047–T053 tabs |

## Dependencies

No new packages installed. All dependencies were already present:
- `recharts` — radial gauge chart
- `@radix-ui/react-tabs` — via `src/components/ui/tabs.tsx` (already in project)
- `lucide-react` — icons (ArrowLeft, Construction)

## Route Registration

Add this route to `App.tsx` inside `<Routes>`, alongside the existing exam route:

```tsx
import AnalysisPage from '@/pages/analysis/AnalysisPage'

// Inside <Routes>:
<Route
  path="/analysis/:attemptId"
  element={
    <PrivateRoute>
      <AnalysisPage />
    </PrivateRoute>
  }
/>
```

## Architecture Decisions

### KpiCard uses dl/dt/dd semantics
Each metric tile renders `<dl>` with `<dt>` for the label and `<dd>` for the value.
This satisfies WCAG definition-list semantics for key-value data.

### Colour-coded KPI values via `valueClassName` prop
Rather than nesting a second `<dl>` inside `children`, the three count cards
(Correct/Incorrect/Unattempted) pass a Tailwind colour class via `valueClassName`.
This keeps the dl structure flat and avoids invalid nested dl elements.

### Gauge implementation
`RadialBarChart` with `startAngle={90}` / `endAngle={-270}` creates a full-circle
gauge. The percentage label is an absolutely positioned `<div>` overlaid on the
`ResponsiveContainer` wrapper (Recharts does not provide a built-in center label for
RadialBarChart). The wrapper carries `role="img"` + `aria-label`.

### Colour thresholds (constants)
```
GAUGE_LOW_THRESHOLD = 40   → red below this
GAUGE_MID_THRESHOLD = 70   → amber 40–69, green 70+
```

### TanStack Query deduplication
Both `AnalysisPage` (for the score strip) and `OverviewSection` call `useOverview(attemptId)`.
They share query key `['analysis', attemptId, 'overview']` so TQ makes exactly one network
request and serves both from cache.

### Null rendering
`fmtNullable(value, decimals?)` renders `null` as `"—"` (em dash).
- `rank`, `percentile`, `topper_score`, `average_score` all route through this helper.
- `average_score` uses `fmtNullable(value, 1)` for one decimal place.
- `percentile` has inline handling so it can append `%`.

### Tab lazy-loading
`forceMount` is NOT passed to `TabsContent`. Radix Tabs only mounts the active panel,
so each section's TQ hook fires on first activation — free lazy data-loading.

### Mobile tab scrolling
The `TabsList` is wrapped in `<div className="overflow-x-auto pb-1">` and the list
itself uses `inline-flex w-max` so all 8 tabs render at natural width and the wrapper
scrolls horizontally on narrow viewports.

## Accessibility Checklist

- [x] `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` implement ARIA tablist pattern (Radix)
- [x] KPI cards use `<dl>/<dt>/<dd>` semantics
- [x] Gauge wrapper: `role="img"` + `aria-label="Score gauge: {n}%"`
- [x] Skeleton containers: `aria-hidden="true"`, parent: `aria-busy="true"`
- [x] Error Alert is rendered first (above grid) with `role="alert"` (from Alert component)
- [x] "Back to Attempts" button has visible text label (not icon-only)
- [x] Score summary strip wrapped in `<section aria-label="Score summary">`

## Upcoming Tasks (T047–T053)

Each placeholder tab becomes its own section component following the same pattern:
1. Create `src/components/analysis/<SectionName>Section.tsx`
2. Call the relevant hook from `useAnalysis.ts` (all hooks already implemented)
3. Replace `<ComingSoonPlaceholder>` in `AnalysisPage.tsx` with the real section
