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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getErrorMessage } from '@/lib/error-utils'
import { registrationImportService } from '@/services/registration-import-service'
import type {
  ImportRowResult,
  RegistrationImportReport,
  ValidationIssueSeverity,
} from '@/types/registrationImport'
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface RegistrationImportDialogProps {
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: () => void
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'created':
      return 'default'
    case 'skipped':
      return 'outline'
    case 'error':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const severityIcon = (severity: ValidationIssueSeverity) => {
  switch (severity) {
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />
    case 'warning':
      return <AlertCircle className="h-4 w-4 text-yellow-600" />
    default:
      return null
  }
}

function ReportRow({ row }: { row: ImportRowResult }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Row {row.row_number}</span>
        {row.external_id && <span className="font-mono text-xs">{row.external_id}</span>}
        {row.registrant_name && <span className="font-medium">{row.registrant_name}</span>}
        {row.registrant_email && (
          <span className="text-xs text-muted-foreground">{row.registrant_email}</span>
        )}
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
      </div>
      <p className="text-sm">{row.message}</p>
      {row.issues && row.issues.length > 0 && (
        <div className="ml-4 space-y-1">
          {row.issues.map((issue, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              {severityIcon(issue.severity)}
              <span className="text-muted-foreground">
                {issue.field_name && <span className="font-medium">{issue.field_name}: </span>}
                {issue.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExampleFormats() {
  const jsonExample = {
    event_id: 'EVT-2026-001',
    registrant_name: 'Jordan Lee',
    registrant_email: 'jordan.lee@example.org',
    registration_date: '2026-02-01',
    quantity: 2,
    external_registration_id: 'REG-100045',
    registrant_phone: '555-123-4567',
    bidder_number: 42,
    table_number: 8,
    guest_count: 2,
    notes: 'Sponsor package',
    ticket_purchase_id: '1b2c3d4e-0000-1111-2222-333344445555',
    ticket_purchaser_email: 'jordan.lee@example.org',
    ticket_purchase_date: '2026-01-20',
  }

  const jsonGuestExample = {
    guest_of_email: 'jordan.lee@example.org',
    registrant_name: 'Casey Guest',
    registrant_email: 'casey.guest@example.org',
    registration_date: '2026-02-01',
    quantity: 1,
    external_registration_id: '',
    registrant_phone: '555-222-7890',
    bidder_number: 84,
    table_number: 8,
    guest_count: 1,
    notes: 'Dietary: vegetarian',
  }

  const csvExample = `event_id,registrant_name,registrant_email,registration_date,quantity,external_registration_id,registrant_phone,bidder_number,table_number,guest_count,guest_of_email,notes,ticket_purchase_id,ticket_purchaser_email,ticket_purchase_date
EVT-2026-001,Jordan Lee,jordan.lee@example.org,2026-02-01,2,REG-100045,555-123-4567,42,8,2,,Sponsor package,1b2c3d4e-0000-1111-2222-333344445555,jordan.lee@example.org,2026-01-20
EVT-2026-001,Casey Guest,casey.guest@example.org,2026-02-01,1,,555-222-7890,84,8,1,jordan.lee@example.org,Dietary: vegetarian,,,
`

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold">JSON Format (Array of Objects)</h4>
        <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
          {JSON.stringify([jsonExample, jsonGuestExample], null, 2)}
        </pre>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold">CSV Format</h4>
        <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
          {csvExample}
        </pre>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Required fields:</strong> registrant_name, registrant_email, registration_date,
          quantity, external_registration_id
        </p>
        <p>
          <strong>Optional fields:</strong> event_id (ignored), registrant_phone, notes,
          bidder_number, table_number, guest_count, guest_of_email, ticket_purchase_id,
          ticket_purchaser_email, ticket_purchase_date
        </p>
        <p>
          <strong>Max rows:</strong> 5,000 per file
        </p>
        <p>
          <strong>Guest rows:</strong> set guest_of_email to the parent registrant email; external_registration_id may be blank
        </p>
      </div>
    </div>
  )
}

export function RegistrationImportDialog({
  eventId,
  open,
  onOpenChange,
  onImportComplete,
}: RegistrationImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<RegistrationImportReport | null>(null)
  const [isPreflight, setIsPreflight] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setReport(null)
    }
  }

  const handlePreflight = async () => {
    if (!file) {
      toast.error('Please select a file to import')
      return
    }

    try {
      setIsPreflight(true)
      const result = await registrationImportService.preflightImport(eventId, file)
      setReport(result)
      if (result.error_rows > 0) {
        toast.error(`Preflight found ${result.error_rows} error(s)`)
      } else if (result.warning_rows > 0) {
        toast.warning(`Preflight passed with ${result.warning_rows} warning(s)`)
      } else {
        toast.success('Preflight passed - ready to import')
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Preflight failed'))
    } finally {
      setIsPreflight(false)
    }
  }

  const handleCommit = async () => {
    if (!file) {
      toast.error('Please select a file to import')
      return
    }

    if (report && report.error_rows > 0) {
      toast.error('Cannot import - fix errors first')
      return
    }

    try {
      setIsCommitting(true)
      const result = await registrationImportService.commitImport(eventId, file)
      setReport(result)
      toast.success(
        `Import complete: ${result.created_count} created, ${result.skipped_count} skipped`
      )
      onImportComplete?.()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Import failed'))
    } finally {
      setIsCommitting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setReport(null)
    setShowExamples(false)
    onOpenChange(false)
  }

  const canCommit = report && report.error_rows === 0 && report.valid_rows > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Registrations</DialogTitle>
          <DialogDescription>
            Upload a JSON, CSV, or Excel file to bulk import event registrations
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!showExamples ? (
            <>
              <div className="space-y-2">
                <label htmlFor="file-upload" className="text-sm font-medium">
                  Select File
                </label>
                <div className="flex gap-2">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".json,.csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={isPreflight || isCommitting}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExamples(true)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Examples
                  </Button>
                </div>
                {file && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                  </p>
                )}
              </div>

              {report && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-sm text-muted-foreground">Summary</p>
                        <div className="mt-1 space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {report.total_rows} total rows
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            {report.valid_rows} valid
                          </div>
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-destructive" />
                            {report.error_rows} errors
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            {report.warning_rows} warnings
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-sm text-muted-foreground">Results</p>
                        <div className="mt-1 space-y-1 text-sm">
                          <div>{report.created_count} created</div>
                          <div>{report.skipped_count} skipped</div>
                          <div>{report.failed_count} failed</div>
                        </div>
                      </div>
                      {report.error_report_url && (
                        <div className="rounded-md border border-border p-3">
                          <p className="text-sm text-muted-foreground">Error report</p>
                          <a
                            className="text-sm font-medium text-primary underline"
                            href={report.error_report_url}
                            download="registration-import-errors.csv"
                          >
                            Download error report
                          </a>
                        </div>
                      )}
                    </div>

                    <ScrollArea className="h-64 rounded-md border border-border p-3">
                      <div className="space-y-3">
                        {report.rows.map((row) => (
                          <ReportRow
                            key={`${row.row_number}-${row.external_id ?? 'row'}`}
                            row={row}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </>
          ) : (
            <ExampleFormats />
          )}
        </div>

        <DialogFooter>
          {showExamples ? (
            <Button variant="outline" onClick={() => setShowExamples(false)}>
              Back
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePreflight}
                disabled={!file || isPreflight || isCommitting}
                variant="secondary"
              >
                {isPreflight && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run Preflight
              </Button>
              <Button
                onClick={handleCommit}
                disabled={!canCommit || isCommitting}
              >
                {isCommitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Upload className="mr-2 h-4 w-4" />
                Confirm Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
