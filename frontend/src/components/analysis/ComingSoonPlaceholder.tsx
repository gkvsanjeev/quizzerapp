import { Construction } from 'lucide-react'

// ---------------------------------------------------------------------------
// ComingSoonPlaceholder
// A lightweight panel rendered for analysis tabs that are not yet implemented
// (T047–T053). Carries no state or data-fetching.
// ---------------------------------------------------------------------------

interface ComingSoonPlaceholderProps {
  title: string
}

export function ComingSoonPlaceholder({ title }: ComingSoonPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 py-20 text-center">
      <Construction className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">This section is coming soon.</p>
      </div>
    </div>
  )
}
