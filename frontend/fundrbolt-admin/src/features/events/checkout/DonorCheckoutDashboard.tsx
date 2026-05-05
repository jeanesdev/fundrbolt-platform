/**
 * DonorCheckoutDashboard — T044
 *
 * Data table showing all registered donors and their checkout status.
 * Filter tabs: All / Not Started / In Progress / Complete
 * Row actions: Manage (opens DonorCheckoutItemEditor)
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, UserCheck } from 'lucide-react'
import {
  type DonorCheckoutStatus,
  listDonorCheckoutStatus,
} from '@/lib/api/checkout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DonorCheckoutItemEditor } from './DonorCheckoutItemEditor'
import { SendCheckoutNotification } from './SendCheckoutNotification'

interface DonorCheckoutDashboardProps {
  eventId: string
}

type FilterTab = 'all' | DonorCheckoutStatus

function StatusBadge({ status }: { status: DonorCheckoutStatus }) {
  if (status === 'complete')
    return (
      <Badge className='bg-green-100 text-green-700 hover:bg-green-100'>
        Complete
      </Badge>
    )
  if (status === 'in_progress')
    return (
      <Badge className='bg-yellow-100 text-yellow-700 hover:bg-yellow-100'>
        In Progress
      </Badge>
    )
  return <Badge variant='secondary'>Not Started</Badge>
}

const PAGE_SIZE = 20

export function DonorCheckoutDashboard({
  eventId,
}: DonorCheckoutDashboardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [page, setPage] = useState(1)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['checkout-donors', eventId, activeTab, page],
    queryFn: () =>
      listDonorCheckoutStatus(eventId, {
        page,
        per_page: PAGE_SIZE,
        status: activeTab === 'all' ? undefined : activeTab,
      }),
  })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'not_started', label: 'Not Started' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'complete', label: 'Complete' },
  ]

  const counts = data?.counts

  function handleTabChange(tab: FilterTab) {
    setActiveTab(tab)
    setPage(1)
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  return (
    <div className='space-y-4'>
      {/* Summary counts */}
      {counts && (
        <div className='flex flex-wrap gap-3 text-sm'>
          <span className='text-muted-foreground'>
            Not Started:{' '}
            <span className='text-foreground font-medium'>
              {counts.not_started}
            </span>
          </span>
          <span className='text-muted-foreground'>
            In Progress:{' '}
            <span className='font-medium text-yellow-700'>
              {counts.in_progress}
            </span>
          </span>
          <span className='text-muted-foreground'>
            Complete:{' '}
            <span className='font-medium text-green-700'>
              {counts.complete}
            </span>
          </span>
        </div>
      )}

      {/* Notification actions */}
      <SendCheckoutNotification eventId={eventId} />

      {/* Filter tabs */}
      <div className='flex gap-1 border-b'>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type='button'
            onClick={() => handleTabChange(key)}
            className={`border-b-2 px-3 pb-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className='flex justify-center py-8'>
          <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
        </div>
      ) : isError ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          Failed to load donors.
        </div>
      ) : !data || data.donors.length === 0 ? (
        <div className='text-muted-foreground flex flex-col items-center py-8 text-sm'>
          <UserCheck className='mb-2 h-8 w-8' />
          No donors found.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='text-right'>Items</TableHead>
                <TableHead className='text-right'>Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.donors.map((donor) => (
                <TableRow
                  key={donor.user_id}
                  className='cursor-pointer'
                  onClick={() => setEditingUserId(donor.user_id)}
                >
                  <TableCell className='font-medium'>
                    {donor.first_name} {donor.last_name}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>
                    {donor.email}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={donor.status} />
                  </TableCell>
                  <TableCell className='text-right'>
                    {donor.item_count}
                  </TableCell>
                  <TableCell className='text-right'>
                    ${(donor.total_cents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingUserId(donor.user_id)
                      }}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between'>
              <p className='text-muted-foreground text-sm'>
                Page {page} of {totalPages} ({data.total} donors)
              </p>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Item editor side panel */}
      {editingUserId && (
        <DonorCheckoutItemEditor
          eventId={eventId}
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
        />
      )}
    </div>
  )
}
