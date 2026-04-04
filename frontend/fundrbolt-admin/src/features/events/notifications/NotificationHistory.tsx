import { useCallback, useEffect, useState } from 'react'
import {
  eventNotificationService,
  type Campaign,
} from '@/services/eventNotificationService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface NotificationHistoryProps {
  eventId: string
  refreshKey: number
}

function recipientLabel(criteria: Record<string, unknown>): string {
  const type = criteria.type as string | undefined
  switch (type) {
    case 'all_attendees':
      return 'All Attendees'
    case 'all_bidders':
      return 'All Bidders'
    case 'specific_table':
      return `Table ${criteria.table_number}`
    case 'individual':
      return `${(criteria.user_ids as string[] | undefined)?.length ?? 0} Recipients`
    case 'item_watchers':
      return 'Item Watchers'
    default:
      return type ?? 'Unknown'
  }
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'sent':
    case 'delivered':
      return 'default'
    case 'pending':
    case 'sending':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '…'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

const PER_PAGE = 10

export function NotificationHistory({
  eventId,
  refreshKey,
}: NotificationHistoryProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await eventNotificationService.listCampaigns(
        eventId,
        page,
        PER_PAGE
      )
      setCampaigns(res.campaigns)
      setTotal(res.total)
    } catch {
      // Silently fail — table will show empty state
    } finally {
      setIsLoading(false)
    }
  }, [eventId, page])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns, refreshKey])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification History</CardTitle>
        <CardDescription>
          Previously sent notification campaigns.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Delivered / Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground text-center'
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground text-center'
                >
                  No notifications sent yet.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell
                    className='max-w-[200px] truncate'
                    title={c.message}
                  >
                    {truncate(c.message, 60)}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {recipientLabel(c.recipient_criteria)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1'>
                      {c.channels.map((ch) => (
                        <Badge key={ch} variant='secondary'>
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.delivered_count} / {c.recipient_count}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatDate(c.sent_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className='mt-4 flex items-center justify-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className='text-muted-foreground text-sm'>
              Page {page} of {totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
