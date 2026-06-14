import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { DifficultyBadge } from '@/components/teacher/DifficultyBadge'
import type { Difficulty } from '@/types/question'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarksRowState {
  question_id: string
  question_text: string
  difficulty: Difficulty
  marks: number
  negative_marks: number
  display_order: number
}

// ── Props ────────────────────────────────────────────────────────────────────

interface StepMarksProps {
  rows: MarksRowState[]
  onUpdateRow: (index: number, field: 'marks' | 'negative_marks' | 'display_order', value: number) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasDuplicateOrders(rows: MarksRowState[]): boolean {
  const orders = rows.map((r) => r.display_order)
  return new Set(orders).size !== orders.length
}

// ── Component ────────────────────────────────────────────────────────────────

export function StepMarks({
  rows,
  onUpdateRow,
  onBack,
  onSubmit,
  isSubmitting,
}: StepMarksProps) {
  const totalMarks = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.marks) || 0), 0),
    [rows],
  )

  const duplicateOrders = useMemo(() => hasDuplicateOrders(rows), [rows])

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{rows.length}</span> questions
        </span>
        <span className="text-muted-foreground">
          Total marks:{' '}
          <span className="font-medium text-foreground">{totalMarks}</span>
        </span>
      </div>

      {/* Duplicate order warning — non-blocking */}
      {duplicateOrders && (
        <Alert>
          <AlertDescription>
            Some questions share the same display order. The paper will still be created, but consider making orders unique for a consistent question sequence.
          </AlertDescription>
        </Alert>
      )}

      {/* Marks table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-28">Difficulty</TableHead>
              <TableHead className="w-28">Marks</TableHead>
              <TableHead className="w-32">Negative Marks</TableHead>
              <TableHead className="w-24">Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.question_id}>
                <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>

                <TableCell className="max-w-[260px]">
                  <span className="line-clamp-2 text-sm">{row.question_text}</span>
                </TableCell>

                <TableCell>
                  <DifficultyBadge difficulty={row.difficulty} />
                </TableCell>

                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={row.marks}
                    onChange={(e) =>
                      onUpdateRow(index, 'marks', Number(e.target.value))
                    }
                    className="w-20"
                    aria-label={`Marks for question ${index + 1}`}
                  />
                </TableCell>

                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    value={row.negative_marks}
                    onChange={(e) =>
                      onUpdateRow(index, 'negative_marks', Number(e.target.value))
                    }
                    className="w-20"
                    aria-label={`Negative marks for question ${index + 1}`}
                  />
                </TableCell>

                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={row.display_order}
                    onChange={(e) =>
                      onUpdateRow(index, 'display_order', Number(e.target.value))
                    }
                    className="w-16"
                    aria-label={`Display order for question ${index + 1}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          ← Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span
                className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Creating…
            </>
          ) : (
            'Create Test Paper'
          )}
        </Button>
      </div>
    </div>
  )
}
