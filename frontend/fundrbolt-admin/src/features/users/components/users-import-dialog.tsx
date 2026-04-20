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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNpoContext } from '@/hooks/use-npo-context'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  buildUserImportErrorReport,
  commitUserImport,
  preflightUserImport,
  USER_IMPORT_EXAMPLE_CSV,
  USER_IMPORT_EXAMPLE_JSON,
  type ImportResult,
  type PreflightResult,
} from '../api/users-import-api'

const MAX_FILE_SIZE_MB = 10

type UsersImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'created':
      return 'default'
    case 'skipped':
      return 'outline'
    case 'membership_added':
      return 'secondary'
    case 'error':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const severityIcon = (severity: string) => {
  switch (severity) {
    case 'error':
      return <XCircle className='text-destructive h-4 w-4' />
    case 'warning':
      return <AlertCircle className='h-4 w-4 text-yellow-600' />
    default:
      return null
  }
}

export function UsersImportDialog({
  open,
  onOpenChange,
}: UsersImportDialogProps) {
  const { selectedNpoId, selectedNpoName } = useNpoContext()
  const [file, setFile] = useState<File | null>(null)
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isPreflighting, setIsPreflighting] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const canRunPreflight = !!file
  const canCommit =
    !!file &&
    !!preflight &&
    preflight.error_rows === 0 &&
    !isCommitting &&
    !result

  const resetState = () => {
    setFile(null)
    setPreflight(null)
    setResult(null)
    setIsPreflighting(false)
    setIsCommitting(false)
  }

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null
    if (!nextFile) {
      setFile(null)
      return
    }

    const lowerName = nextFile.name.toLowerCase()
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.json')) {
      toast.error('Only .csv or .json files are supported.')
      return
    }

    if (nextFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be smaller than ${MAX_FILE_SIZE_MB} MB.`)
      return
    }

    setFile(nextFile)
    setPreflight(null)
    setResult(null)
  }

  const downloadExample = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const handlePreflight = async () => {
    if (!file) return
    setIsPreflighting(true)
    try {
      const response = await preflightUserImport(selectedNpoId, file)
      setPreflight(response)
      setResult(null)
    } catch (_error) {
      toast.error('Preflight failed. Please check the file and try again.')
    } finally {
      setIsPreflighting(false)
    }
  }

  const handleCommit = async () => {
    if (!file || !preflight || isCommitting || result) return
    setIsCommitting(true)
    try {
      const response = await commitUserImport(
        selectedNpoId,
        preflight.preflight_id,
        file
      )
      setResult(response)
    } catch (_error) {
      const errorMessage = (
        _error as {
          response?: { data?: { detail?: { message?: string } | string } }
        }
      )?.response?.data?.detail
      const message =
        typeof errorMessage === 'string' ? errorMessage : errorMessage?.message
      toast.error(
        message || 'Import failed. Please try again or re-run preflight.'
      )
    } finally {
      setIsCommitting(false)
    }
  }

  const handleDownloadSummaryErrors = async () => {
    if (!result?.rows?.length) return
    try {
      const response = await buildUserImportErrorReport({
        format: 'csv',
        rows: result.rows,
      })
      const blob = new Blob([response.content], {
        type: response.content_type,
      })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = response.filename
      link.click()
    } catch (_error) {
      toast.error('Unable to build error report.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] w-[calc(100dvw-2rem)] max-w-[calc(100dvw-2rem)] flex-col overflow-hidden p-4 sm:max-w-3xl sm:p-6'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <UploadCloud size={18} /> Import Users
          </DialogTitle>
          <DialogDescription>
            Upload a JSON or CSV file.
            {selectedNpoName
              ? ` Memberships will be added to ${selectedNpoName}.`
              : ' Select an NPO to add memberships.'}
            Run preflight to validate rows before confirming the import.
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 space-y-4 overflow-y-auto'>
          <div className='space-y-2'>
            <label htmlFor='user-import-file' className='text-sm font-medium'>
              Select File
            </label>
            <div className='flex min-w-0 items-center gap-2'>
              <input
                id='user-import-file'
                type='file'
                accept='.csv,.json'
                onChange={handleFileChange}
                disabled={isPreflighting || isCommitting}
                className='file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium'
              />
              {file && (
                <Badge variant='outline' className='gap-1'>
                  <FileText className='h-3 w-3' />
                  {file.name}
                </Badge>
              )}
            </div>
            {!selectedNpoId && (
              <p className='text-muted-foreground text-sm'>
                NPO selection is optional. Select one to add memberships.
              </p>
            )}
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
                  {USER_IMPORT_EXAMPLE_CSV}
                </code>
              </pre>
              <Button
                variant='outline'
                size='sm'
                className='w-full text-center break-words whitespace-normal'
                onClick={() =>
                  downloadExample(
                    USER_IMPORT_EXAMPLE_CSV,
                    'user-import-example.csv',
                    'text/csv'
                  )
                }
              >
                <Download className='mr-2 h-4 w-4' />
                Download CSV Example
              </Button>
            </TabsContent>
            <TabsContent value='json' className='w-full min-w-0 space-y-2'>
              <p className='text-muted-foreground text-sm'>
                JSON array of users:
              </p>
              <pre className='bg-muted w-full max-w-full rounded-md p-3 text-[11px] break-words whitespace-pre-wrap sm:text-xs'>
                <code className='block break-words whitespace-pre-wrap'>
                  {USER_IMPORT_EXAMPLE_JSON}
                </code>
              </pre>
              <Button
                variant='outline'
                size='sm'
                className='w-full text-center break-words whitespace-normal'
                onClick={() =>
                  downloadExample(
                    USER_IMPORT_EXAMPLE_JSON,
                    'user-import-example.json',
                    'application/json'
                  )
                }
              >
                <Download className='mr-2 h-4 w-4' />
                Download JSON Example
              </Button>
            </TabsContent>
          </Tabs>

          <div className='text-muted-foreground space-y-1 text-xs'>
            <p>
              <strong>Required fields:</strong> full_name, email, role
            </p>
            <p>
              <strong>Roles:</strong> npo_admin, event_coordinator, donor
              (attendees are created without NPO membership)
            </p>
            <p>
              <strong>Optional fields:</strong> npo_identifier (informational),
              phone, title, organization_name, address_line1, address_line2,
              city, state, postal_code, country, profile_picture_url,
              social_media_links, password
            </p>
            <p>
              <strong>Max rows:</strong> 5,000 per file
            </p>
            <p>
              <strong>Passwords:</strong> if blank, a temporary password is
              generated and a reset email is sent
            </p>
            <p>
              <strong>Social links:</strong> provide a JSON object (CSV uses a
              JSON string)
            </p>
          </div>

          {(preflight || result) && (
            <>
              <Separator />
              <div className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {preflight && (
                    <div className='border-border rounded-md border p-3'>
                      <p className='text-muted-foreground text-sm'>Summary</p>
                      <div className='mt-1 space-y-1 text-sm'>
                        <div className='flex items-center gap-2'>
                          <FileText className='h-4 w-4' />
                          {preflight.total_rows} total rows
                        </div>
                        <div className='flex items-center gap-2'>
                          <CheckCircle2 className='h-4 w-4 text-green-600' />
                          {preflight.valid_rows} valid
                        </div>
                        <div className='flex items-center gap-2'>
                          <XCircle className='text-destructive h-4 w-4' />
                          {preflight.error_rows} errors
                        </div>
                        <div className='flex items-center gap-2'>
                          <AlertCircle className='h-4 w-4 text-yellow-600' />
                          {preflight.warning_rows} warnings
                        </div>
                      </div>
                    </div>
                  )}
                  {result && (
                    <div className='border-border rounded-md border p-3'>
                      <p className='text-muted-foreground text-sm'>Results</p>
                      <div className='mt-1 space-y-1 text-sm'>
                        <div>{result.created_rows} created</div>
                        <div>{result.skipped_rows} skipped</div>
                        <div>
                          {result.membership_added_rows} memberships added
                        </div>
                        <div>{result.failed_rows} failed</div>
                      </div>
                    </div>
                  )}
                  {preflight?.error_report_url && preflight.error_rows > 0 && (
                    <div className='border-border rounded-md border p-3'>
                      <p className='text-muted-foreground text-sm'>
                        Error report
                      </p>
                      <a
                        className='text-primary text-sm font-medium underline'
                        href={preflight.error_report_url}
                        download='user-import-errors.csv'
                      >
                        Download error report
                      </a>
                    </div>
                  )}
                  {result && result.failed_rows > 0 && (
                    <div className='border-border rounded-md border p-3'>
                      <p className='text-muted-foreground text-sm'>
                        Failure report
                      </p>
                      <Button
                        variant='outline'
                        size='sm'
                        className='w-full text-center break-words whitespace-normal'
                        onClick={handleDownloadSummaryErrors}
                      >
                        <Download className='mr-2 h-4 w-4' />
                        Download failure report
                      </Button>
                    </div>
                  )}
                </div>

                <ScrollArea className='border-border h-64 rounded-md border p-3'>
                  <div className='space-y-3'>
                    {result?.rows?.length ? (
                      result.rows.map((row) => (
                        <div
                          key={`${row.row_number}-${row.email ?? 'row'}`}
                          className='border-border flex flex-col gap-2 border-b pb-3'
                        >
                          <div className='flex flex-wrap items-center gap-2 text-sm'>
                            <span className='text-muted-foreground'>
                              Row {row.row_number}
                            </span>
                            {row.full_name && (
                              <span className='font-medium'>
                                {row.full_name}
                              </span>
                            )}
                            {row.email && (
                              <span className='text-muted-foreground text-xs'>
                                {row.email}
                              </span>
                            )}
                            <Badge variant={statusVariant(row.status)}>
                              {row.status}
                            </Badge>
                          </div>
                          <p className='text-sm'>{row.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className='space-y-2'>
                        {preflight?.issues?.map((issue) => (
                          <div
                            key={`issue-${issue.row_number}-${issue.message}`}
                            className='flex items-start gap-2 text-xs'
                          >
                            {severityIcon(issue.severity)}
                            <span className='text-muted-foreground'>
                              {issue.field_name && (
                                <span className='font-medium'>
                                  {issue.field_name}:{' '}
                                </span>
                              )}
                              Row {issue.row_number}: {issue.message}
                            </span>
                          </div>
                        ))}
                        {preflight?.warnings?.map((issue) => (
                          <div
                            key={`warning-${issue.row_number}-${issue.message}`}
                            className='flex items-start gap-2 text-xs'
                          >
                            {severityIcon(issue.severity)}
                            <span className='text-muted-foreground'>
                              {issue.field_name && (
                                <span className='font-medium'>
                                  {issue.field_name}:{' '}
                                </span>
                              )}
                              Row {issue.row_number}: {issue.message}
                            </span>
                          </div>
                        ))}
                        {!preflight?.issues?.length &&
                          !preflight?.warnings?.length && (
                            <p className='text-muted-foreground text-sm'>
                              No issues to display.
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handlePreflight}
            disabled={!canRunPreflight || isPreflighting || isCommitting}
            variant='secondary'
          >
            {isPreflighting && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            Run Preflight
          </Button>
          <Button onClick={handleCommit} disabled={!canCommit || isCommitting}>
            {isCommitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            <Upload className='mr-2 h-4 w-4' />
            Confirm Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
