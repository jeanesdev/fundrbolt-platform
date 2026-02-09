/**
 * TicketSalesImportDialog
 * Dialog for importing ticket sales in bulk from CSV, JSON, or Excel files
 */

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
import {
  commitTicketSalesImport,
  EXAMPLE_CSV,
  EXAMPLE_JSON,
  preflightTicketSalesImport,
} from '@/services/ticketSalesImport'
import type { ImportResult, IssueSeverity, PreflightIssue, PreflightResult } from '@/types/ticketSalesImport'
import { AlertCircle, CheckCircle, Download, FileText, Upload, XCircle } from 'lucide-react'
import { useState } from 'react'

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
    <div className="flex flex-col gap-1 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Row {issue.row_number}</span>
        {issue.field_name && <span className="font-medium">{issue.field_name}</span>}
        <Badge variant={statusVariant(issue.severity)}>{issue.severity}</Badge>
      </div>
      <p className="text-sm">{issue.message}</p>
      {issue.raw_value && (
        <p className="text-xs text-muted-foreground">Value: {issue.raw_value}</p>
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
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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

    setIsProcessing(true)
    setStage('preflight')

    try {
      const result = await preflightTicketSalesImport(eventId, selectedFile)
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
      toast({
        title: 'Preflight Failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
      setStage('select')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile || !preflightResult) return

    setIsProcessing(true)
    setStage('import')

    try {
      const result = await commitTicketSalesImport(
        eventId,
        preflightResult.preflight_id,
        selectedFile
      )
      setImportResult(result)
      setStage('complete')

      toast({
        title: 'Import Complete',
        description: `Created ${result.created_rows} ticket sales, skipped ${result.skipped_rows}.`,
      })

      onImportComplete?.()
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
      setStage('results')
    } finally {
      setIsProcessing(false)
    }
  }

  const canImport = preflightResult && preflightResult.error_rows === 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Ticket Sales</DialogTitle>
          <DialogDescription>
            Upload a CSV, JSON, or Excel file to import ticket sales in bulk. Maximum 5,000
            rows per file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {stage === 'select' && (
            <>
              <div className="space-y-2">
                <label htmlFor="file-upload" className="text-sm font-medium">
                  Select File
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.json,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="flex-1"
                  />
                  {selectedFile && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {selectedFile.name}
                    </Badge>
                  )}
                </div>
              </div>

              <Tabs defaultValue="csv" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="csv">CSV Example</TabsTrigger>
                  <TabsTrigger value="json">JSON Example</TabsTrigger>
                </TabsList>
                <TabsContent value="csv" className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    CSV file with header row:
                  </p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code>{EXAMPLE_CSV}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'ticket-sales-example.csv'
                      a.click()
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV Example
                  </Button>
                </TabsContent>
                <TabsContent value="json" className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    JSON array of ticket sales:
                  </p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code>{EXAMPLE_JSON}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const blob = new Blob([EXAMPLE_JSON], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'ticket-sales-example.json'
                      a.click()
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download JSON Example
                  </Button>
                </TabsContent>
              </Tabs>
            </>
          )}

          {stage === 'preflight' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 animate-pulse" />
                <span className="text-sm">Validating file...</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {stage === 'results' && preflightResult && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Totals</p>
                  <div className="mt-1 text-sm">
                    {preflightResult.total_rows} rows •{' '}
                    {preflightResult.valid_rows} valid
                  </div>
                  <div className="mt-1 text-sm">
                    {preflightResult.error_rows} errors •{' '}
                    {preflightResult.warning_rows} warnings
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1 flex items-center gap-2">
                    {canImport ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">Ready to import</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">Fix errors first</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {(preflightResult.issues.length > 0 ||
                preflightResult.warnings.length > 0) && (
                <ScrollArea className="h-64 rounded-md border border-border p-3">
                  <div className="space-y-3">
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
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 animate-pulse" />
                <span className="text-sm">Importing ticket sales...</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {stage === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="rounded-md border border-green-600 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-900">
                    Import completed successfully
                  </p>
                </div>
                <div className="mt-2 text-sm text-green-800">
                  Created {importResult.created_rows} ticket sales
                  {importResult.skipped_rows > 0 &&
                    `, skipped ${importResult.skipped_rows}`}
                  {importResult.failed_rows > 0 &&
                    `, failed ${importResult.failed_rows}`}
                </div>
              </div>

              {importResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm font-medium">Warnings</p>
                  </div>
                  <ScrollArea className="h-32 rounded-md border border-border p-3">
                    <div className="space-y-2">
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

        <DialogFooter>
          {stage === 'select' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePreflight} disabled={!selectedFile || isProcessing}>
                <Upload className="h-4 w-4 mr-2" />
                Run Preflight
              </Button>
            </>
          )}

          {stage === 'results' && (
            <>
              <Button variant="outline" onClick={() => setStage('select')}>
                Choose Different File
              </Button>
              <Button onClick={handleImport} disabled={!canImport || isProcessing}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Import
              </Button>
            </>
          )}

          {stage === 'complete' && (
            <Button onClick={handleClose}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
