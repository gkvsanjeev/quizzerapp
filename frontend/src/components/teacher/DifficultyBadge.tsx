import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Difficulty } from '@/types/question'

const STYLES: Record<Difficulty, string> = {
  easy: 'border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  medium: 'border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100',
  hard: 'border-transparent bg-rose-100 text-rose-700 hover:bg-rose-100',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge variant="outline" className={cn('capitalize', STYLES[difficulty])}>
      {difficulty}
    </Badge>
  )
}
