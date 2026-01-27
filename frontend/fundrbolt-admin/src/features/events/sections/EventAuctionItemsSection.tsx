import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AuctionItemImportReport } from '@/components/auction-items/AuctionItemImportReport'
import { AuctionItemList } from '../components/AuctionItemList'
import { useEventWorkspace } from '../useEventWorkspace'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { auctionItemService } from '@/services/auctionItemService'
import { Upload } from 'lucide-react'
import { useState } from 'react'
import type { ImportReport } from '@/types/auctionItemImport'

export function EventAuctionItemsSection() {
  const navigate = useNavigate()
  const { currentEvent, auctionItems, fetchAuctionItems } = useEventWorkspace()
  const deleteAuctionItem = useAuctionItemStore((state) => state.deleteAuctionItem)
  const eventId = currentEvent.slug || currentEvent.id  // Use slug for navigation
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const [isPreflighting, setIsPreflighting] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  const handlePreflight = async () => {
    if (!importFile) {
      toast.error('Please select a ZIP file to import')
      return
    }
    try {
      setIsPreflighting(true)
      const report = await auctionItemService.preflightImport(currentEvent.id, importFile)
      setImportReport(report)
      toast.success('Preflight completed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Preflight failed'
      toast.error(message)
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
      const report = await auctionItemService.commitImport(currentEvent.id, importFile)
      setImportReport(report)
      await fetchAuctionItems(currentEvent.id)
      toast.success('Import completed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      toast.error(message)
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
          isLoading={false}
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
              Upload a ZIP file that includes auction_items.xlsx and an images/ folder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              type="file"
              accept=".zip"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              The ZIP must include auction_items.xlsx at the root and an images/ folder with
              matching filenames.
            </p>

            {importReport && <AuctionItemImportReport report={importReport} />}
          </div>

          <DialogFooter className="gap-2">
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
