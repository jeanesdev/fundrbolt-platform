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
import { getErrorMessage } from '@/lib/error-utils'
import { registrationImportService } from '@/services/registration-import-service'
import type {
  ImportRowResult,
  RegistrationImportReport,
  ValidationIssueSeverity,
} from '@/types/registrationImport'
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, Upload, XCircle } from 'lucide-react'
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
  // Suppress warnings for event_id and ticket_purchase_id
  const filteredIssues = (row.issues || []).filter(
    (issue) =>
      !(
        issue.severity === 'warning' &&
        (issue.field_name === 'event_id' || issue.field_name === 'ticket_purchase_id')
      )
  )
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
      {filteredIssues.length > 0 && (
        <div className="ml-4 space-y-1">
          {filteredIssues.map((issue, idx) => (
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

const EXAMPLE_JSON = JSON.stringify(
  [
    {
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
      food_option: 'Vegetarian',
      notes: 'Sponsor package',
      ticket_purchase_id: '1b2c3d4e-0000-1111-2222-333344445555',
      ticket_purchaser_email: 'jordan.lee@example.org',
      ticket_purchase_date: '2026-01-20',
    },
    {
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
      food_option: 'Vegetarian',
      notes: 'Dietary: vegetarian',
    },
  ],
  null,
  2
)

const EXAMPLE_CSV = `event_id,registrant_name,registrant_email,registration_date,quantity,external_registration_id,registrant_phone,bidder_number,table_number,guest_count,guest_of_email,food_option,notes,ticket_purchase_id,ticket_purchaser_email,ticket_purchase_date
EVT-2026-001,Jordan Lee,jordan.lee@example.org,2026-02-01,2,REG-100045,555-123-4567,42,8,2,,Vegetarian,Sponsor package,1b2c3d4e-0000-1111-2222-333344445555,jordan.lee@example.org,2026-01-20
EVT-2026-001,Casey Guest,casey.guest@example.org,2026-02-01,1,,555-222-7890,84,8,1,jordan.lee@example.org,Vegetarian,Dietary: vegetarian,,,
`

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
      if (result.error_rows > 0) {
        toast.error(`Import completed with ${result.error_rows} error(s)`)
      } else {
        toast.success(
          `Import complete: ${result.created_count} created, ${result.skipped_count} skipped`
        )
        onImportComplete?.()
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Import failed'))
    } finally {
      setIsCommitting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setReport(null)
    onOpenChange(false)
  }

  const canCommit = report && report.error_rows === 0 && report.valid_rows > 0

  // Compute filtered warning count (excluding event_id warnings)
  const filteredWarningRows =
    report?.rows.filter(
      (row) =>
        (row.issues || []).some(
          (issue) =>
            issue.severity === 'warning' &&
            issue.field_name !== 'event_id'
        )
    ).length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100dvw-2rem)] max-w-[calc(100dvw-2rem)] sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Import Registrations</DialogTitle>
          <DialogDescription>
            Upload a JSON, CSV, or Excel file to bulk import event registrations
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <label htmlFor="file-upload" className="text-sm font-medium">
              Select File
            </label>
            <div className="flex items-center gap-2 min-w-0">
              <input
                id="file-upload"
                type="file"
                accept=".json,.csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={isPreflight || isCommitting}
                className="flex-1 min-w-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              {file && (
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {file.name}
                </Badge>
              )}
            </div>
          </div>

          <Tabs defaultValue="csv" className="w-full min-w-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">CSV Example</TabsTrigger>
              <TabsTrigger value="json">JSON Example</TabsTrigger>
            </TabsList>
            <TabsContent value="csv" className="space-y-2 w-full min-w-0">
              <p className="text-sm text-muted-foreground">CSV file with header row:</p>
              <pre className="rounded-md bg-muted p-3 text-[11px] sm:text-xs whitespace-pre-wrap break-words w-full max-w-full">
                <code className="block whitespace-pre-wrap break-words">{EXAMPLE_CSV}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="w-full whitespace-normal break-words text-center"
                onClick={() => {
                  const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'registration-import-example.csv'
                  a.click()
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV Example
              </Button>
            </TabsContent>
            <TabsContent value="json" className="space-y-2 w-full min-w-0">
              <p className="text-sm text-muted-foreground">JSON array of registrations:</p>
              <pre className="rounded-md bg-muted p-3 text-[11px] sm:text-xs whitespace-pre-wrap break-words w-full max-w-full">
                <code className="block whitespace-pre-wrap break-words">{EXAMPLE_JSON}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="w-full whitespace-normal break-words text-center"
                onClick={() => {
                  const blob = new Blob([EXAMPLE_JSON], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'registration-import-example.json'
                  a.click()
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download JSON Example
              </Button>
            </TabsContent>
          </Tabs>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Required fields:</strong> registrant_name, registrant_email,
              registration_date, quantity, external_registration_id
            </p>
            <p>
              <strong>Optional fields:</strong> event_id (ignored), registrant_phone, notes,
              bidder_number, table_number, guest_count, guest_of_email, food_option,
              ticket_purchase_id, ticket_purchaser_email, ticket_purchase_date
            </p>
            <p>
              <strong>Max rows:</strong> 5,000 per file
            </p>
            <p>
              <strong>Guest rows:</strong> set guest_of_email to the parent registrant email;
              external_registration_id may be blank
            </p>
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
                        {filteredWarningRows} warnings
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
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
