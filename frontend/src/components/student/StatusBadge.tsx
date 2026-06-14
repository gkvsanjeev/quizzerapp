import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type AttemptStatus = 'submitted' | 'in_progress' | 'timed_out' | string

interface StatusBadgeProps {
  status: AttemptStatus
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  submitted: {
    label: 'Submitted',
    className:
      'border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80',
  },
  in_progress: {
    label: 'In Progress',
    className:
      'border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100/80',
  },
  timed_out: {
    label: 'Timed Out',
    className:
      'border-transparent bg-muted text-muted-foreground hover:bg-muted/80',
  },
}

const DEFAULT_CONFIG = {
  label: 'Unknown',
  className: 'border-transparent bg-muted text-muted-foreground',
}

/**
 * StatusBadge — maps an attempt status string to a colour-coded Badge.
 * Text is always the primary status indicator; colour is supplemental.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? DEFAULT_CONFIG
  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  )
}
