/**
 * TicketSalesImportDialog
 * Dialog for importing ticket sales in bulk from CSV, JSON, or Excel files
 */
import { useRef, useState } from 'react'
import axios from 'axios'
import {
  commitTicketSalesImport,
  EXAMPLE_CSV,
  EXAMPLE_JSON,
  preflightTicketSalesImport,
} from '@/services/ticketSalesImport'
import type {
  ImportResult,
  IssueSeverity,
  PreflightIssue,
  PreflightResult,
} from '@/types/ticketSalesImport'
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Upload,
  XCircle,
} from 'lucide-react'
import { getErrorMessage } from '@/lib/error-utils'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface TicketSalesImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  onImportComplete?: () => void
}

type ImportStage = 'select' | 'preflight' | 'results' | 'import' | 'complete'

const statusVariant = (severity: IssueSeverity) => {
  switch (severity) {
    case 'error':
      return 'destructive'
    case 'warning':
      return 'outline'
    default:
      return 'secondary'
  }
}

function IssueRow({ issue }: { issue: PreflightIssue }) {
  return (
    <div className='border-border flex flex-col gap-1 border-b pb-3'>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span className='text-muted-foreground'>Row {issue.row_number}</span>
        {issue.field_name && (
          <Badge variant='outline' className='text-xs'>
            {issue.field_name}
          </Badge>
        )}
        <Badge
          variant={statusVariant(issue.severity)}
          className='text-xs capitalize'
        >
          {issue.severity}
        </Badge>
      </div>
      <p className='text-sm'>{issue.message}</p>
      {issue.raw_value && (
        <p className='text-muted-foreground text-xs'>
          Value: {issue.raw_value}
        </p>
      )}
    </div>
  )
}

export function TicketSalesImportDialog({
  open,
  onOpenChange,
  eventId,
  onImportComplete,
}: TicketSalesImportDialogProps) {
  const { toast } = useToast()
  const [stage, setStage] = useState<ImportStage>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preflightResult, setPreflightResult] =
    useState<PreflightResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)

  const buildErrorDescription = (error: unknown, fallback: string) => {
    const message = getErrorMessage(error, fallback)

    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const statusText = error.response?.statusText
      const url = error.config?.url
      const statusLabel = status
        ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}`
        : undefined
      const parts = [
        message,
        statusLabel,
        url ? `Endpoint: ${url}` : undefined,
      ].filter(Boolean)
      return parts.join(' • ')
    }

    return message
  }

  const handleClose = () => {
    setStage('select')
    setSelectedFile(null)
    setPreflightResult(null)
    setImportResult(null)
    onOpenChange(false)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreflightResult(null)
      setImportResult(null)
    }
  }

  const handlePreflight = async () => {
    if (!selectedFile) return

    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller

    setIsProcessing(true)
    setStage('preflight')

    try {
      const result = await preflightTicketSalesImport(
        eventId,
        selectedFile,
        controller.signal
      )
      setPreflightResult(result)
      setStage('results')

      if (result.error_rows === 0) {
        toast({
          title: 'Preflight Passed',
          description: `${result.valid_rows} of ${result.total_rows} rows are valid and ready to import.`,
        })
      } else {
        toast({
          title: 'Preflight Failed',
          description: `Found ${result.error_rows} errors. Please fix them and try again.`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
        toast({
          title: 'Preflight Canceled',
          description: 'Preflight was canceled before completion.',
        })
        setStage('select')
        return
      }
      toast({
        title: 'Preflight Failed',
        description: buildErrorDescription(error, 'Preflight failed'),
        variant: 'destructive',
      })
      setStage('select')
    } finally {
      activeRequest.current = null
      setIsProcessing(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !preflightResult) return

    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller

    setIsProcessing(true)
    setStage('import')

    try {
      const result = await commitTicketSalesImport(
        eventId,
        preflightResult.preflight_id,
        selectedFile,
        controller.signal
      )
      setImportResult(result)
      setStage('complete')

      toast({
        title: 'Import Complete',
        description: `Created ${result.created_rows} ticket sales, skipped ${result.skipped_rows}.`,
      })

      onImportComplete?.()
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
        toast({
          title: 'Import Canceled',
          description: 'Import was canceled before completion.',
        })
        setStage('results')
        return
      }
      toast({
        title: 'Import Failed',
        description: buildErrorDescription(error, 'Import failed'),
        variant: 'destructive',
      })
      setStage('results')
    } finally {
      activeRequest.current = null
      setIsProcessing(false)
    }
  }

  const handleCancelProcessing = () => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setIsProcessing(false)
    setStage('select')
  }

  const canImport = preflightResult && preflightResult.error_rows === 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='flex max-h-[90vh] w-[calc(100dvw-2rem)] max-w-[calc(100dvw-2rem)] flex-col overflow-hidden p-4 sm:max-w-3xl sm:p-6'>
        <DialogHeader>
          <DialogTitle>Import Ticket Sales</DialogTitle>
          <DialogDescription>
            Upload a CSV, JSON, or Excel file to import ticket sales in bulk.
            Maximum 5,000 rows per file.
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1'>
          <div className='w-full max-w-full min-w-0 space-y-4'>
            {stage === 'select' && (
              <>
                <div className='space-y-2'>
                  <label htmlFor='file-upload' className='text-sm font-medium'>
                    Select File
                  </label>
                  <div className='flex min-w-0 items-center gap-2'>
                    <input
                      id='file-upload'
                      type='file'
                      accept='.csv,.json,.xlsx,.xls'
                      onChange={handleFileSelect}
                      className='file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium'
                    />
                    {selectedFile && (
                      <Badge variant='outline' className='gap-1'>
                        <FileText className='h-3 w-3' />
                        {selectedFile.name}
                      </Badge>
                    )}
                  </div>
                </div>

                <Tabs defaultValue='csv' className='w-full min-w-0'>
                  <TabsList className='grid w-full grid-cols-2'>
                    <TabsTrigger value='csv'>CSV Example</TabsTrigger>
                    <TabsTrigger value='json'>JSON Example</TabsTrigger>
                  </TabsList>
                  <TabsContent value='csv' className='w-full min-w-0 space-y-2'>
                    <p className='text-muted-foreground text-sm'>
                      CSV file with header row:
                    </p>
                    <pre className='bg-muted w-full max-w-full rounded-md p-3 text-[11px] break-words whitespace-pre-wrap sm:text-xs'>
                      <code className='block break-words whitespace-pre-wrap'>
                        {EXAMPLE_CSV}
                      </code>
                    </pre>
                    <Button
                      variant='outline'
                      size='sm'
                      className='w-full text-center break-words whitespace-normal'
                      onClick={() => {
                        const blob = new Blob([EXAMPLE_CSV], {
                          type: 'text/csv',
                        })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'ticket-sales-example.csv'
                        a.click()
                      }}
                    >
                      <Download className='mr-2 h-4 w-4' />
                      Download CSV Example
                    </Button>
                  </TabsContent>
                  <TabsContent
                    value='json'
                    className='w-full min-w-0 space-y-2'
                  >
                    <p className='text-muted-foreground text-sm'>
                      JSON array of ticket sales:
                    </p>
                    <pre className='bg-muted w-full max-w-full rounded-md p-3 text-[11px] break-words whitespace-pre-wrap sm:text-xs'>
                      <code className='block break-words whitespace-pre-wrap'>
                        {EXAMPLE_JSON}
                      </code>
                    </pre>
                    <Button
                      variant='outline'
                      size='sm'
                      className='w-full text-center break-words whitespace-normal'
                      onClick={() => {
                        const blob = new Blob([EXAMPLE_JSON], {
                          type: 'application/json',
                        })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'ticket-sales-example.json'
                        a.click()
                      }}
                    >
                      <Download className='mr-2 h-4 w-4' />
                      Download JSON Example
                    </Button>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {stage === 'preflight' && (
              <div className='space-y-4'>
                <div className='flex items-center gap-2'>
                  <Upload className='h-5 w-5 animate-pulse' />
                  <span className='text-sm'>Validating file...</span>
                </div>
                <Progress value={undefined} className='w-full' />
              </div>
            )}

            {stage === 'results' && preflightResult && (
              <div className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div className='border-border rounded-md border p-3'>
                    <p className='text-muted-foreground text-sm'>Totals</p>
                    <div className='mt-1 text-sm'>
                      {preflightResult.total_rows} rows •{' '}
                      {preflightResult.valid_rows} valid
                    </div>
                    <div className='mt-1 text-sm'>
                      {preflightResult.error_rows} errors •{' '}
                      {preflightResult.warning_rows} warnings
                    </div>
                  </div>
                  <div className='border-border rounded-md border p-3'>
                    <p className='text-muted-foreground text-sm'>Status</p>
                    <div className='mt-1 flex items-center gap-2'>
                      {canImport ? (
                        <>
                          <CheckCircle className='h-4 w-4 text-green-600' />
                          <span className='text-sm text-green-600'>
                            Ready to import
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className='text-destructive h-4 w-4' />
                          <span className='text-destructive text-sm'>
                            Fix errors first
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {(preflightResult.issues.length > 0 ||
                  preflightResult.warnings.length > 0) && (
                  <ScrollArea className='border-border h-64 rounded-md border p-3'>
                    <div className='space-y-3'>
                      {preflightResult.issues.map((issue, idx) => (
                        <IssueRow key={`error-${idx}`} issue={issue} />
                      ))}
                      {preflightResult.warnings.map((issue, idx) => (
                        <IssueRow key={`warning-${idx}`} issue={issue} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {stage === 'import' && (
              <div className='space-y-4'>
                <div className='flex items-center gap-2'>
                  <Upload className='h-5 w-5 animate-pulse' />
                  <span className='text-sm'>Importing ticket sales...</span>
                </div>
                <Progress value={undefined} className='w-full' />
              </div>
            )}

            {stage === 'complete' && importResult && (
              <div className='space-y-4'>
                <div className='rounded-md border border-green-600 bg-green-50 p-4'>
                  <div className='flex items-center gap-2'>
                    <CheckCircle className='h-5 w-5 text-green-600' />
                    <p className='text-sm font-medium text-green-900'>
                      Import completed successfully
                    </p>
                  </div>
                  <div className='mt-2 text-sm text-green-800'>
                    Created {importResult.created_rows} ticket sales
                    {importResult.skipped_rows > 0 &&
                      `, skipped ${importResult.skipped_rows}`}
                    {importResult.failed_rows > 0 &&
                      `, failed ${importResult.failed_rows}`}
                  </div>
                </div>

                {importResult.warnings.length > 0 && (
                  <div className='space-y-2'>
                    <div className='flex items-center gap-2'>
                      <AlertCircle className='h-4 w-4 text-yellow-600' />
                      <p className='text-sm font-medium'>Warnings</p>
                    </div>
                    <ScrollArea className='border-border h-32 rounded-md border p-3'>
                      <div className='space-y-2'>
                        {importResult.warnings.map((warning, idx) => (
                          <IssueRow key={`warning-${idx}`} issue={warning} />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {(stage === 'preflight' || stage === 'import') && (
            <Button variant='outline' onClick={handleCancelProcessing}>
              Cancel
            </Button>
          )}
          {stage === 'select' && (
            <>
              <Button variant='outline' onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePreflight}
                disabled={!selectedFile || isProcessing}
              >
                <Upload className='mr-2 h-4 w-4' />
                Run Preflight
              </Button>
            </>
          )}

          {stage === 'results' && (
            <>
              <Button variant='outline' onClick={() => setStage('select')}>
                Choose Different File
              </Button>
              <Button
                onClick={handleImport}
                disabled={!canImport || isProcessing}
              >
                <CheckCircle className='mr-2 h-4 w-4' />
                Confirm Import
              </Button>
            </>
          )}

          {stage === 'complete' && (
            <Button onClick={handleClose}>
              <CheckCircle className='mr-2 h-4 w-4' />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
