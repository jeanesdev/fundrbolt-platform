import { AuctionItemImportReport } from '@/components/auction-items/AuctionItemImportReport'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/error-utils'
import { auctionItemService } from '@/services/auctionItemService'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import type { ImportReport } from '@/types/auctionItemImport'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuctionItemList } from '../components/AuctionItemList'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventAuctionItemsSection() {
  const navigate = useNavigate()
  const { currentEvent, auctionItems, fetchAuctionItems } = useEventWorkspace()
  const deleteAuctionItem = useAuctionItemStore((state) => state.deleteAuctionItem)
  const isLoading = useAuctionItemStore((state) => state.isLoading)
  const error = useAuctionItemStore((state) => state.error)
  const eventId = currentEvent.slug || currentEvent.id  // Use slug for navigation
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const [isPreflighting, setIsPreflighting] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitProgress, setCommitProgress] = useState<{ current: number; total: number } | null>(null)

  useEffect(() => {
    if (currentEvent?.id) {
      fetchAuctionItems(currentEvent.id).catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load auction items'
        toast.error(message)
      })
    }
  }, [currentEvent?.id, fetchAuctionItems])

  const handlePreflight = async () => {
    if (!importFile) {
      toast.error('Please select a ZIP file to import')
      return
    }
    try {
      setIsPreflighting(true)
      const report = await auctionItemService.preflightImport(currentEvent.id, importFile)
      setImportReport(report)
      setCommitProgress(report.total_rows > 0 ? { current: 0, total: report.total_rows } : null)
      toast.success('Preflight completed')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Preflight failed'))
    } finally {
      setIsPreflighting(false)
    }
  }

  const handleCommit = async () => {
    if (!importFile) {
      toast.error('Please select a ZIP file to import')
      return
    }
    try {
      setIsCommitting(true)
      if (importReport?.total_rows) {
        setCommitProgress({ current: 0, total: importReport.total_rows })
      }
      let progressTimer: ReturnType<typeof setInterval> | null = null
      if (importReport?.total_rows) {
        progressTimer = setInterval(() => {
          setCommitProgress((prev) => {
            if (!prev) return prev
            const next = Math.min(prev.total - 1, prev.current + 1)
            return { ...prev, current: next }
          })
        }, 600)
      }
      const report = await auctionItemService.commitImport(currentEvent.id, importFile)
      if (progressTimer) {
        clearInterval(progressTimer)
      }
      if (report.total_rows > 0) {
        setCommitProgress({ current: report.total_rows, total: report.total_rows })
      }
      setImportReport(report)
      await fetchAuctionItems(currentEvent.id)
      toast.success('Import completed')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Import failed'))
    } finally {
      setIsCommitting(false)
    }
  }

  const closeImport = () => {
    setImportOpen(false)
    setImportFile(null)
    setImportReport(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Auction Items</CardTitle>
            <CardDescription>
              Manage live and silent auction items for your fundraising event
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import Items
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <AuctionItemList
          items={auctionItems}
          isLoading={isLoading}
          error={error}
          onAdd={() => navigate({ to: '/events/$eventId/auction-items/create', params: { eventId } })}
          onEdit={(item) =>
            navigate({
              to: '/events/$eventId/auction-items/$itemId/edit',
              params: { eventId, itemId: item.id },
            })
          }
          onView={(item) =>
            navigate({
              to: '/events/$eventId/auction-items/$itemId',
              params: { eventId, itemId: item.id },
            })
          }
          onDelete={async (item) => {
            if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return
            try {
              await deleteAuctionItem(currentEvent.id, item.id)
              toast.success('Auction item deleted successfully')
              await fetchAuctionItems(currentEvent.id)
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete auction item'
              toast.error(message)
            }
          }}
        />
      </CardContent>
      <Dialog open={importOpen} onOpenChange={(open) => (open ? setImportOpen(true) : closeImport())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Auction Items</DialogTitle>
            <DialogDescription>
              Upload a ZIP containing a single .xlsx or .csv workbook and any .jpg/.png images anywhere in the ZIP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              type="file"
              accept=".zip"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              The workbook must include required columns and image filenames must match the image file names.
            </p>

            {importReport && <AuctionItemImportReport report={importReport} />}
          </div>

          <DialogFooter className="gap-2">
            {(isPreflighting || isCommitting) && (
              <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {isPreflighting
                  ? 'Running preflight…'
                  : commitProgress
                    ? `Importing items… ${commitProgress.current}/${commitProgress.total} (estimated)`
                    : 'Importing items…'}
              </div>
            )}
            <Button variant="outline" onClick={closeImport}>
              Cancel
            </Button>
            <Button onClick={handlePreflight} disabled={isPreflighting}>
              {isPreflighting ? 'Running preflight...' : 'Run Preflight'}
            </Button>
            <Button
              onClick={handleCommit}
              disabled={isCommitting || !importReport || importReport.error_count > 0}
            >
              {isCommitting ? 'Importing...' : 'Commit Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
