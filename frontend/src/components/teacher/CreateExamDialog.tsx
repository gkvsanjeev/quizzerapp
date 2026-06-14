import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useCreateExam } from '@/hooks/useExams'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const examSchema = z.object({
  title: z
    .string()
    .min(3, 'At least 3 characters')
    .max(120, 'Maximum 120 characters'),
  exam_type: z.string().min(1, 'Select a type'),
  description: z.string().max(500, 'Maximum 500 characters').optional(),
})

type ExamFormValues = z.infer<typeof examSchema>

const EXAM_TYPES = ['JEE', 'NEET', 'UPSC', 'GATE', 'CAT', 'Other'] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateExamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateExamDialog({ open, onOpenChange }: CreateExamDialogProps) {
  const createExam = useCreateExam()

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: '',
      exam_type: '',
      description: '',
    },
  })

  // Reset form whenever the dialog closes so stale values never re-appear.
  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  async function onSubmit(values: ExamFormValues) {
    try {
      await createExam.mutateAsync({
        title: values.title,
        exam_type: values.exam_type,
        description: values.description || undefined,
      })
      toast.success('Exam created', {
        description: `"${values.title}" is ready to receive subjects.`,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      toast.error('Failed to create exam', { description: message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Exam</DialogTitle>
          <DialogDescription>
            Create a new exam series. You can add subjects and questions after saving.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. JEE Main 2025 Mock #1"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Exam type */}
            <FormField
              control={form.control}
              name="exam_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exam Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="Select exam type">
                        <SelectValue placeholder="Select a type…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EXAM_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this exam series…"
                      rows={3}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createExam.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createExam.isPending}>
                {createExam.isPending ? 'Creating…' : 'Create Exam'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
