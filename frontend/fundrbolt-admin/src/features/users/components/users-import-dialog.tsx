import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useNpoContext } from '@/hooks/use-npo-context'
import { UploadCloud } from 'lucide-react'
import { useMemo, useState } from 'react'
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

  const canRunPreflight = !!file && !!selectedNpoId
  const canCommit =
    !!file &&
    !!selectedNpoId &&
    !!preflight &&
    preflight.error_rows === 0 &&
    !isCommitting

  const issueSummary = useMemo(() => {
    if (!preflight) return null
    const errors = preflight.issues?.length || 0
    const warnings = preflight.warnings?.length || 0
    return { errors, warnings }
  }, [preflight])

  const resetState = () => {
    setFile(null)
    setPreflight(null)
    setResult(null)
    setIsPreflighting(false)
    setIsCommitting(false)
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
    if (!file || !selectedNpoId) return
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
    if (!file || !selectedNpoId || !preflight) return
    setIsCommitting(true)
    try {
      const response = await commitUserImport(
        selectedNpoId,
        preflight.preflight_id,
        file
      )
      setResult(response)
    } catch (_error) {
      toast.error('Import failed. Please try again or re-run preflight.')
    } finally {
      setIsCommitting(false)
    }
  }

  const handleDownloadErrorReport = async () => {
    if (!preflight?.error_report_url) return
    const link = document.createElement('a')
    link.href = preflight.error_report_url
    link.download = 'user-import-errors.csv'
    link.click()
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
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) resetState()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <UploadCloud size={18} /> Import Users
          </DialogTitle>
          <DialogDescription>
            Upload a JSON or CSV file for {selectedNpoName || 'the selected NPO'}.
            Run preflight to validate rows before confirming the import.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Input
              type='file'
              accept='.csv,.json'
              onChange={handleFileChange}
            />
            <div className='flex flex-wrap gap-2 text-sm'>
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  downloadExample(
                    USER_IMPORT_EXAMPLE_CSV,
                    'user-import-example.csv',
                    'text/csv'
                  )
                }
              >
                Download CSV Example
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  downloadExample(
                    USER_IMPORT_EXAMPLE_JSON,
                    'user-import-example.json',
                    'application/json'
                  )
                }
              >
                Download JSON Example
              </Button>
            </div>
            {!selectedNpoId && (
              <p className='text-sm text-amber-600'>
                Select an NPO before running an import.
              </p>
            )}
          </div>

          {preflight && (
            <div className='rounded-md border border-muted p-3 text-sm'>
              <div className='flex flex-wrap gap-4'>
                <span>Total rows: {preflight.total_rows}</span>
                <span>Valid: {preflight.valid_rows}</span>
                <span>Errors: {preflight.error_rows}</span>
                <span>Warnings: {preflight.warning_rows}</span>
              </div>
              {issueSummary && (issueSummary.errors > 0 || issueSummary.warnings > 0) && (
                <div className='mt-2 space-y-2'>
                  {preflight.issues?.length > 0 && (
                    <div>
                      <p className='font-medium text-red-600'>Errors</p>
                      <ul className='list-disc ps-5 text-red-600'>
                        {preflight.issues.slice(0, 5).map((issue) => (
                          <li key={`${issue.row_number}-${issue.message}`}>
                            Row {issue.row_number}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preflight.warnings?.length > 0 && (
                    <div>
                      <p className='font-medium text-amber-600'>Warnings</p>
                      <ul className='list-disc ps-5 text-amber-600'>
                        {preflight.warnings.slice(0, 5).map((issue) => (
                          <li key={`${issue.row_number}-${issue.message}`}>
                            Row {issue.row_number}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {preflight.error_report_url && preflight.error_rows > 0 && (
                <Button
                  type='button'
                  variant='outline'
                  className='mt-3'
                  onClick={handleDownloadErrorReport}
                >
                  Download Error Report
                </Button>
              )}
            </div>
          )}

          {result && (
            <div className='rounded-md border border-muted p-3 text-sm'>
              <div className='flex flex-wrap gap-4'>
                <span>Created: {result.created_rows}</span>
                <span>Skipped: {result.skipped_rows}</span>
                <span>Memberships added: {result.membership_added_rows}</span>
                <span>Failed: {result.failed_rows}</span>
              </div>
              {result.failed_rows > 0 && (
                <Button
                  type='button'
                  variant='outline'
                  className='mt-3'
                  onClick={handleDownloadSummaryErrors}
                >
                  Download Failure Report
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>Close</Button>
          </DialogClose>
          <Button
            type='button'
            variant='secondary'
            disabled={!canRunPreflight || isPreflighting}
            onClick={handlePreflight}
          >
            {isPreflighting ? 'Running Preflight...' : 'Run Preflight'}
          </Button>
          <Button
            type='button'
            disabled={!canCommit}
            onClick={handleCommit}
          >
            {isCommitting ? 'Importing...' : 'Confirm Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
