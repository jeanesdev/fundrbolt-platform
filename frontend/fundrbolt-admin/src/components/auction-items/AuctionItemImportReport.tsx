import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ImportReport, ImportRowResult } from '@/types/auctionItemImport'

interface AuctionItemImportReportProps {
  report: ImportReport
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'created':
      return 'default'
    case 'updated':
      return 'secondary'
    case 'skipped':
      return 'outline'
    case 'error':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function ReportRow({ row }: { row: ImportRowResult }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Row {row.row_number}</span>
        {row.external_id && <span className="font-medium">{row.external_id}</span>}
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
        {row.image_status && (
          <span className="text-xs text-muted-foreground">Image: {row.image_status}</span>
        )}
      </div>
      <p className="text-sm">{row.message}</p>
    </div>
  )
}

export function AuctionItemImportReport({ report }: AuctionItemImportReportProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <p className="text-sm text-muted-foreground">Totals</p>
          <div className="mt-1 text-sm">
            {report.total_rows} rows • {report.created_count} created • {report.updated_count} updated
          </div>
          <div className="mt-1 text-sm">
            {report.error_count} errors • {report.skipped_count} skipped
          </div>
        </div>
        {report.error_report_url && (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">Error report</p>
            <a
              className="text-sm font-medium text-primary underline"
              href={report.error_report_url}
              download="auction-item-import-errors.csv"
            >
              Download error report
            </a>
          </div>
        )}
      </div>

      <ScrollArea className="h-64 rounded-md border border-border p-3">
        <div className="space-y-3">
          {report.rows.map((row) => (
            <ReportRow key={`${row.row_number}-${row.external_id ?? 'row'}`} row={row} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
