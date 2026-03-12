import type { ImportReport, ImportRowResult } from '@/types/auctionItemImport'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

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
    <div className='border-border flex flex-col gap-1 border-b pb-3'>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span className='text-muted-foreground'>Row {row.row_number}</span>
        {row.external_id && (
          <span className='font-medium'>{row.external_id}</span>
        )}
        {row.title && (
          <span className='text-muted-foreground'>{row.title}</span>
        )}
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
        <span className='text-muted-foreground text-xs'>
          Images: {row.image_count ?? 0}
        </span>
        {row.image_status && (
          <span className='text-muted-foreground text-xs'>
            Image: {row.image_status}
          </span>
        )}
      </div>
      <p className='text-sm'>{row.message}</p>
    </div>
  )
}

export function AuctionItemImportReport({
  report,
}: AuctionItemImportReportProps) {
  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='border-border rounded-md border p-3'>
          <p className='text-muted-foreground text-sm'>Totals</p>
          <div className='mt-1 text-sm'>
            {report.total_rows} rows • {report.created_count} created •{' '}
            {report.updated_count} updated
          </div>
          <div className='mt-1 text-sm'>
            {report.error_count} errors • {report.skipped_count} skipped
          </div>
        </div>
        {report.error_report_url && (
          <div className='border-border rounded-md border p-3'>
            <p className='text-muted-foreground text-sm'>Error report</p>
            <a
              className='text-primary text-sm font-medium underline'
              href={report.error_report_url}
              download='auction-item-import-errors.csv'
            >
              Download error report
            </a>
          </div>
        )}
      </div>

      <ScrollArea className='border-border h-64 rounded-md border p-3'>
        <div className='space-y-3'>
          {report.rows.map((row) => (
            <ReportRow
              key={`${row.row_number}-${row.external_id ?? 'row'}`}
              row={row}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
