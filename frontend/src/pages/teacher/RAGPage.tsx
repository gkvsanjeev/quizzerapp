import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Upload, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { TeacherPageShell } from '@/components/teacher/TeacherPageShell'
import { GenerateQuestionsPanel } from '@/components/rag/GenerateQuestionsPanel'
import { useDocuments, useUploadDocument } from '@/hooks/useRAG'
import type { DocStatus } from '@/types/rag'

const MAX_FILE_SIZE = 50 * 1024 * 1024

const STATUS_CONFIG: Record<DocStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  processing: { label: 'Processing', icon: Loader2, className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  ready: { label: 'Ready', icon: CheckCircle2, className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-red-100 text-red-800 hover:bg-red-100' },
}

function StatusBadge({ status }: { status: DocStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}

export default function RAGPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: documents, isLoading, isError, refetch } = useDocuments()
  const uploadDoc = useUploadDocument()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large', { description: 'Maximum file size is 50MB.' })
      e.target.value = ''
      return
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/tiff']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file type', {
        description: 'Please upload a PDF or image file (PNG, JPEG, WEBP, TIFF).',
      })
      e.target.value = ''
      return
    }

    setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) return

    try {
      await uploadDoc.mutateAsync(selectedFile)
      toast.success('Document uploaded', {
        description: 'Processing will begin shortly. Refresh the list to check status.',
      })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error('Upload failed', { description: 'An unexpected error occurred.' })
    }
  }

  return (
    <TeacherPageShell
      title="AI Question Generation"
      description="Upload study materials and generate MCQ questions using AI"
    >
      <div className="space-y-8">
        {/* Upload section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" />
              Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label
                  htmlFor="file-upload"
                  className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 px-4 py-8 text-center transition-colors hover:border-primary/50"
                >
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {selectedFile ? selectedFile.name : 'Click to select a PDF or image file'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Maximum size: 50MB. Supported: PDF, PNG, JPEG, WEBP, TIFF
                    </p>
                  </div>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,application/pdf,image/png,image/jpeg,image/webp,image/tiff"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadDoc.isPending}
                className="gap-2"
              >
                {uploadDoc.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Document list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Uploaded Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : isError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error loading documents</AlertTitle>
                <AlertDescription>
                  <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : documents && documents.length > 0 ? (
              <div className="divide-y">
                {documents.map((doc) => {
                  return (
                    <div key={doc.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.file_type} &middot;{' '}
                            {new Date(doc.created_at).toLocaleDateString()}
                            {doc.page_count != null && ` \u00B7 ${doc.page_count} pages`}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={doc.processing_status} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">No documents uploaded yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload a PDF or image file to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Generate questions panel */}
        <GenerateQuestionsPanel />
      </div>
    </TeacherPageShell>
  )
}
