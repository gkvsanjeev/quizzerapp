import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DeleteQuestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionText: string
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteQuestionDialog({
  open,
  onOpenChange,
  questionText,
  onConfirm,
  isDeleting,
}: DeleteQuestionDialogProps) {
  const preview =
    questionText.length > 60 ? `${questionText.slice(0, 60)}…` : questionText

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete question?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The question &ldquo;{preview}&rdquo; will be
            permanently removed from the question bank.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            aria-busy={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
