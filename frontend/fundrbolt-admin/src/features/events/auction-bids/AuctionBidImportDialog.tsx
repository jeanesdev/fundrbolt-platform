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
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/error-utils'
import { auctionBidService } from '@/services/auctionBidService'
import type {
  AuctionBidImportIssue,
  AuctionBidImportSummary,
  AuctionBidPreflightResult,
} from '@/types/auctionBidImport'
import axios from 'axios'
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Upload,
  XCircle,
} from 'lucide-react'
import { useRef, useState } from 'react'

interface AuctionBidImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  onImportComplete?: (summary: AuctionBidImportSummary) => void
}

type ImportStage = 'select' | 'preflight' | 'results' | 'import' | 'complete'
const REQUEST_TIMEOUT_MS = 60000
const LOG_PREFIX = '[auction-bids-import]'

const logInfo = (message: string, payload?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.info(message, payload)
}

const logWarn = (message: string, payload?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.warn(message, payload)
}

const logError = (message: string, payload?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.error(message, payload)
}

const statusVariant = (severity: AuctionBidImportIssue['severity']) => {
  switch (severity) {
    case 'error':
      return 'destructive'
    case 'warning':
      return 'outline'
    default:
      return 'secondary'
  }
}

const EXAMPLE_CSV = `donor_email,auction_item_code,bid_amount,bid_time
donor1001@example.org,ITEM-500,150.00,2026-02-01T19:45:00-06:00
donor1002@example.org,ITEM-501,200.00,2026-02-01T19:47:30-06:00`

const EXAMPLE_JSON = `[
  {
    "donor_email": "donor1001@example.org",
    "auction_item_code": "ITEM-500",
    "bid_amount": 150.00,
    "bid_time": "2026-02-01T19:45:00-06:00"
  },
  {
    "donor_email": "donor1002@example.org",
    "auction_item_code": "ITEM-501",
    "bid_amount": 200.00,
    "bid_time": "2026-02-01T19:47:30-06:00"
  }
]`

function IssueRow({ issue }: { issue: AuctionBidImportIssue }) {
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

export function AuctionBidImportDialog({
  open,
  onOpenChange,
  eventId,
  onImportComplete,
}: AuctionBidImportDialogProps) {
  const { toast } = useToast()
  const [stage, setStage] = useState<ImportStage>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preflightResult, setPreflightResult] =
    useState<AuctionBidPreflightResult | null>(null)
  const [importResult, setImportResult] =
    useState<AuctionBidImportSummary | null>(null)
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
    logInfo(`${LOG_PREFIX} preflight start`, {
      eventId,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
    })
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let didTimeout = false

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true
        controller.abort()
        logWarn(`${LOG_PREFIX} preflight timeout`, {
          eventId,
          fileName: selectedFile.name,
        })
        reject(new Error('Preflight timed out'))
      }, REQUEST_TIMEOUT_MS)
    })

    setIsProcessing(true)
    setStage('preflight')

    try {
      const result = await Promise.race([
        auctionBidService.preflightImport(
          eventId,
          selectedFile,
          controller.signal
        ),
        timeoutPromise,
      ])
      logInfo(`${LOG_PREFIX} preflight success`, {
        eventId,
        totalRows: result.total_rows,
        invalidRows: result.invalid_rows,
        warningRows: result.warning_rows,
      })
      setPreflightResult(result)
      setStage('results')

      if (result.invalid_rows === 0) {
        toast({
          title: 'Preflight Passed',
          description: `${result.valid_rows} of ${result.total_rows} rows are valid and ready to import.`,
        })
      } else {
        toast({
          title: 'Preflight Failed',
          description: `Found ${result.invalid_rows} errors. Please fix them and try again.`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logError(`${LOG_PREFIX} preflight error`, {
          eventId,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method,
        })
      } else {
        logError(`${LOG_PREFIX} preflight error`, { eventId, error })
      }
      if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
        toast({
          title: didTimeout ? 'Preflight Timed Out' : 'Preflight Canceled',
          description: didTimeout
            ? 'Preflight exceeded 60 seconds. Please try again with a smaller file.'
            : 'Preflight was canceled before completion.',
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
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      setIsProcessing(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !preflightResult) return
    logInfo(`${LOG_PREFIX} import start`, {
      eventId,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      importBatchId: preflightResult.import_batch_id,
    })
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let didTimeout = false

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true
        controller.abort()
        logWarn(`${LOG_PREFIX} import timeout`, {
          eventId,
          importBatchId: preflightResult.import_batch_id,
        })
        reject(new Error('Import timed out'))
      }, REQUEST_TIMEOUT_MS)
    })

    setIsProcessing(true)
    setStage('import')

    try {
      const result = await Promise.race([
        auctionBidService.confirmImport(
          eventId,
          { import_batch_id: preflightResult.import_batch_id },
          selectedFile,
          controller.signal
        ),
        timeoutPromise,
      ])
      logInfo(`${LOG_PREFIX} import success`, {
        eventId,
        importBatchId: result.import_batch_id,
        createdBids: result.created_bids,
        skippedBids: result.skipped_bids,
      })
      setImportResult(result)
      setStage('complete')
      toast({
        title: 'Import Complete',
        description: `Created ${result.created_bids} bids${result.skipped_bids ? `, skipped ${result.skipped_bids}` : ''
          }.`,
      })
      onImportComplete?.(result)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logError(`${LOG_PREFIX} import error`, {
          eventId,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method,
        })
      } else {
        logError(`${LOG_PREFIX} import error`, { eventId, error })
      }
      if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
        toast({
          title: didTimeout ? 'Import Timed Out' : 'Import Canceled',
          description: didTimeout
            ? 'Import exceeded 60 seconds. Please try again or contact support if this continues.'
            : 'Import was canceled before completion.',
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
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      setIsProcessing(false)
    }
  }

  const handleCancelProcessing = () => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setIsProcessing(false)
    setStage('select')
  }

  const canImport = preflightResult && preflightResult.invalid_rows === 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='flex max-h-[90vh] w-[calc(100dvw-2rem)] max-w-[calc(100dvw-2rem)] flex-col overflow-hidden p-4 sm:max-w-3xl sm:p-6'>
        <DialogHeader>
          <DialogTitle>Import Auction Bids</DialogTitle>
          <DialogDescription>
            Upload a CSV, JSON, or Excel file to import auction bids in bulk.
            Maximum 10,000 rows per file.
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
                        a.download = 'auction-bids-example.csv'
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
                      JSON array of auction bids:
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
                        a.download = 'auction-bids-example.json'
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
                      {preflightResult.invalid_rows} errors •{' '}
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

                {(preflightResult.row_errors.length > 0 ||
                  preflightResult.row_warnings.length > 0) && (
                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-sm'>
                        <AlertCircle className='text-muted-foreground h-4 w-4' />
                        Issues
                      </div>
                      <ScrollArea className='border-border h-48 w-full rounded-md border p-3'>
                        <div className='space-y-3'>
                          {preflightResult.row_errors.map((issue, index) => (
                            <IssueRow key={`error-${index}`} issue={issue} />
                          ))}
                          {preflightResult.row_warnings.map((issue, index) => (
                            <IssueRow key={`warning-${index}`} issue={issue} />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
              </div>
            )}

            {stage === 'import' && (
              <div className='space-y-4'>
                <div className='flex items-center gap-2'>
                  <Upload className='h-5 w-5 animate-pulse' />
                  <span className='text-sm'>Importing bids...</span>
                </div>
                <Progress value={undefined} className='w-full' />
              </div>
            )}

            {stage === 'complete' && importResult && (
              <div className='space-y-4'>
                <div className='border-border rounded-md border p-4'>
                  <div className='flex items-center gap-2 text-green-600'>
                    <CheckCircle className='h-5 w-5' />
                    <span className='font-medium'>Import completed</span>
                  </div>
                  <p className='text-muted-foreground mt-2 text-sm'>
                    Created {importResult.created_bids} bids
                    {importResult.skipped_bids
                      ? `, skipped ${importResult.skipped_bids}`
                      : ''}
                    .
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className='gap-2'>
          {isProcessing && (
            <Button variant='outline' onClick={handleCancelProcessing}>
              Cancel
            </Button>
          )}
          {!isProcessing && (
            <Button variant='outline' onClick={handleClose}>
              Close
            </Button>
          )}
          {stage === 'select' && (
            <Button onClick={handlePreflight} disabled={!selectedFile}>
              Run Preflight
            </Button>
          )}
          {stage === 'results' && (
            <Button onClick={handleImport} disabled={!canImport}>
              Confirm Import
            </Button>
          )}
          {stage === 'complete' && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
