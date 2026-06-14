import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import type { Exam } from '@/types/exam'

// ── Schema ──────────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  exam_id: z.string().min(1, 'Select an exam'),
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters'),
  duration: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Must be a whole number')
    .min(1, 'Minimum 1 minute')
    .max(360, 'Maximum 360 minutes'),
  total_marks: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .min(1, 'Must be at least 1'),
  negative_marking_factor: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .min(0, 'Cannot be negative')
    .max(4, 'Cannot exceed 4'),
  shuffle_questions: z.boolean(),
  shuffle_options: z.boolean(),
})

export type PaperSettingsFormValues = z.infer<typeof settingsSchema>

// ── Props ────────────────────────────────────────────────────────────────────

interface StepSettingsProps {
  exams: Exam[]
  examsLoading: boolean
  defaultValues?: Partial<PaperSettingsFormValues>
  onNext: (values: PaperSettingsFormValues) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function StepSettings({
  exams,
  examsLoading,
  defaultValues,
  onNext,
}: StepSettingsProps) {
  const form = useForm<PaperSettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      exam_id: '',
      title: '',
      duration: 60,
      total_marks: 100,
      negative_marking_factor: 0.25,
      shuffle_questions: false,
      shuffle_options: false,
      ...defaultValues,
    },
  })

  return (
    <Form {...form}>
      <form
        id="step-settings-form"
        onSubmit={form.handleSubmit(onNext)}
        className="space-y-5"
        noValidate
      >
        {/* Exam picker */}
        <FormField
          control={form.control}
          name="exam_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Exam <span className="text-destructive">*</span>
              </FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={examsLoading}
              >
                <FormControl>
                  <SelectTrigger aria-required="true">
                    <SelectValue
                      placeholder={examsLoading ? 'Loading exams…' : 'Select an exam'}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Paper Title <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. JEE Main Mock Test #3"
                  aria-required="true"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Duration + Total marks — 2-column on sm+ */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Duration */}
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-1.5">
                  <FormLabel>
                    Duration (minutes) <span className="text-destructive">*</span>
                  </FormLabel>
                  <Tooltip>
                    <TooltipTrigger type="button" aria-label="Duration hint">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Enter minutes. Stored internally as seconds.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={360}
                    step={1}
                    aria-required="true"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Total marks */}
          <FormField
            control={form.control}
            name="total_marks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Total Marks <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    aria-required="true"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Negative marking factor */}
        <FormField
          control={form.control}
          name="negative_marking_factor"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-1.5">
                <FormLabel>Negative Marking Factor</FormLabel>
                <Tooltip>
                  <TooltipTrigger type="button" aria-label="Negative marking hint">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>0.25 means &frac14; mark deducted per wrong answer. Set 0 to disable.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={4}
                  step={0.25}
                  className="max-w-[160px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Shuffle toggles */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="shuffle_questions"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Shuffle Questions</FormLabel>
                  <FormDescription id="shuffle-questions-desc">
                    Randomise question order for each student.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby="shuffle-questions-desc"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shuffle_options"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Shuffle Options</FormLabel>
                  <FormDescription id="shuffle-options-desc">
                    Randomise A/B/C/D option order for each student.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby="shuffle-options-desc"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button type="submit">Next: Select Questions →</Button>
        </div>
      </form>
    </Form>
  )
}
