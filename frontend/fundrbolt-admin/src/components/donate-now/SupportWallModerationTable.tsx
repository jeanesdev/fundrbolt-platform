import { useCallback, useMemo, useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowUpDown,
  CheckCircle2,
  EyeOff,
  Filter,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { donateNowAdminApi, type AdminSupportWallEntry } from '@/api/donateNow'
import { useViewPreference } from '@/hooks/use-view-preference'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table/pagination'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'

interface SupportWallModerationTableProps {
  npoId: string | null
}

const textFilter: FilterFn<AdminSupportWallEntry> = (
  row,
  columnId,
  filterValue
) => {
  const search = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!search) return true
  return String(row.getValue(columnId) ?? '')
    .toLowerCase()
    .includes(search)
}

const exactFilter: FilterFn<AdminSupportWallEntry> = (
  row,
  columnId,
  filterValue
) => {
  const selected = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!selected || selected === 'all') return true
  return String(row.getValue(columnId) ?? '').toLowerCase() === selected
}

const booleanLabel = (value: boolean) => (value ? 'yes' : 'no')

const formatCurrency = (amountCents?: number | null) =>
  amountCents == null ? 'Hidden' : `$${(amountCents / 100).toFixed(2)}`

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

type HeaderFilterConfig =
  | {
      type: 'text'
      placeholder: string
    }
  | {
      type: 'select'
      options: Array<{ label: string; value: string }>
    }

interface SupportWallColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  filter?: HeaderFilterConfig
}

const MODERATION_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Unreviewed', value: 'unreviewed' },
  { label: 'Approved', value: 'approved' },
  { label: 'Hidden', value: 'hidden' },
]

const YES_NO_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]

const DONATION_STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Captured', value: 'captured' },
  { label: 'Pending', value: 'pending' },
  { label: 'Declined', value: 'declined' },
  { label: 'Cancelled', value: 'cancelled' },
]

function renderModerationBadge(entry: AdminSupportWallEntry) {
  if (entry.moderation_status === 'hidden') {
    return <Badge variant='secondary'>Hidden</Badge>
  }

  if (entry.moderation_status === 'approved') {
    return <Badge variant='outline'>Approved</Badge>
  }

  return <Badge variant='secondary'>Unreviewed</Badge>
}

function SupportWallColumnHeader<TData, TValue>({
  column,
  title,
  filter,
}: SupportWallColumnHeaderProps<TData, TValue>) {
  const sortIcon =
    column.getIsSorted() === 'desc' ? (
      <ArrowDownIcon className='h-4 w-4' />
    ) : column.getIsSorted() === 'asc' ? (
      <ArrowUpIcon className='h-4 w-4' />
    ) : (
      <ArrowUpDown className='h-4 w-4' />
    )

  return (
    <div className='flex items-center gap-2'>
      <Button
        variant='ghost'
        size='sm'
        className='h-8 px-2'
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {title}
        {sortIcon}
      </Button>

      {filter ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground rounded-sm p-1'
              aria-label={`Filter ${title}`}
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='start'
            className='w-56'
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Toggle sort
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter</DropdownMenuLabel>

            {filter.type === 'text' ? (
              <>
                <div
                  className='px-2 py-2'
                  onClick={(event) => event.stopPropagation()}
                >
                  <Input
                    placeholder={filter.placeholder}
                    value={String(column.getFilterValue() ?? '')}
                    onChange={(event) =>
                      column.setFilterValue(event.target.value || undefined)
                    }
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </div>
                <DropdownMenuItem
                  disabled={!column.getFilterValue()}
                  onSelect={() => column.setFilterValue(undefined)}
                >
                  Clear filter
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuRadioGroup
                  value={String(column.getFilterValue() ?? 'all')}
                  onValueChange={(value) =>
                    column.setFilterValue(value === 'all' ? undefined : value)
                  }
                >
                  {filter.options.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuItem
                  disabled={!column.getFilterValue()}
                  onSelect={() => column.setFilterValue(undefined)}
                >
                  Clear filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

export function SupportWallModerationTable({
  npoId,
}: SupportWallModerationTableProps) {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useViewPreference('support-wall')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at_display', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['support-wall-admin', npoId],
    queryFn: () => {
      if (!npoId) {
        throw new Error('NPO could not be resolved for support wall loading.')
      }

      return donateNowAdminApi
        .getSupportWall(npoId, { include_hidden: true, per_page: 100 })
        .then((r) => r.data)
    },
    enabled: Boolean(npoId),
  })

  const hideMutation = useMutation({
    mutationFn: (entryId: string) => {
      if (!npoId) {
        throw new Error(
          'NPO could not be resolved for support wall moderation.'
        )
      }

      return donateNowAdminApi.hideEntry(npoId, entryId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-wall-admin', npoId] })
      toast.success('Donation hidden')
    },
    onError: () => toast.error('Failed to hide donation'),
  })

  const approveMutation = useMutation({
    mutationFn: (entryId: string) => {
      if (!npoId) {
        throw new Error(
          'NPO could not be resolved for support wall moderation.'
        )
      }

      return donateNowAdminApi.approveEntry(npoId, entryId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-wall-admin', npoId] })
      toast.success('Donation approved')
    },
    onError: () => toast.error('Failed to approve donation'),
  })

  const bulkApproveMutation = useMutation({
    mutationFn: (entryIds: string[]) => {
      if (!npoId) {
        throw new Error(
          'NPO could not be resolved for support wall moderation.'
        )
      }

      return donateNowAdminApi.bulkApproveEntries(npoId, entryIds)
    },
    onSuccess: () => {
      setRowSelection({})
      queryClient.invalidateQueries({ queryKey: ['support-wall-admin', npoId] })
      toast.success('Donations approved')
    },
    onError: () => toast.error('Failed to approve selected donations'),
  })

  const bulkHideMutation = useMutation({
    mutationFn: (entryIds: string[]) => {
      if (!npoId) {
        throw new Error(
          'NPO could not be resolved for support wall moderation.'
        )
      }

      return donateNowAdminApi.bulkHideEntries(npoId, entryIds)
    },
    onSuccess: () => {
      setRowSelection({})
      queryClient.invalidateQueries({ queryKey: ['support-wall-admin', npoId] })
      toast.success('Donations hidden')
    },
    onError: () => toast.error('Failed to hide selected donations'),
  })

  const { mutate: hideEntry } = hideMutation
  const { mutate: approveEntry } = approveMutation

  const handleHide = useCallback(
    (entryId: string) => {
      hideEntry(entryId)
    },
    [hideEntry]
  )

  const handleApprove = useCallback(
    (entryId: string) => {
      approveEntry(entryId)
    },
    [approveEntry]
  )

  const renderEntryActions = useCallback(
    (entry: AdminSupportWallEntry) => {
      const isApproving =
        approveMutation.isPending && approveMutation.variables === entry.id
      const isHiding =
        hideMutation.isPending && hideMutation.variables === entry.id

      if (entry.is_hidden) {
        return (
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleApprove(entry.id)}
            disabled={isApproving}
          >
            {isApproving ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <CheckCircle2 className='mr-2 h-4 w-4' />
            )}
            Approve
          </Button>
        )
      }

      if (entry.moderation_status === 'unreviewed') {
        return (
          <>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleApprove(entry.id)}
              disabled={isApproving}
            >
              {isApproving ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <CheckCircle2 className='mr-2 h-4 w-4' />
              )}
              Approve
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleHide(entry.id)}
              disabled={isHiding}
            >
              {isHiding ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <EyeOff className='mr-2 h-4 w-4' />
              )}
              Hide
            </Button>
          </>
        )
      }

      return (
        <Button
          variant='outline'
          size='sm'
          onClick={() => handleHide(entry.id)}
          disabled={isHiding}
        >
          {isHiding ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <EyeOff className='mr-2 h-4 w-4' />
          )}
          Hide
        </Button>
      )
    },
    [
      approveMutation.isPending,
      approveMutation.variables,
      handleApprove,
      handleHide,
      hideMutation.isPending,
      hideMutation.variables,
    ]
  )

  const columns = useMemo<ColumnDef<AdminSupportWallEntry>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label='Select all rows'
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label='Select row'
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'moderation_status',
        accessorKey: 'moderation_status',
        filterFn: exactFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Moderation'
            filter={{ type: 'select', options: MODERATION_OPTIONS }}
          />
        ),
        cell: ({ row }) => renderModerationBadge(row.original),
      },
      {
        id: 'donor_name',
        accessorFn: (row) => row.donor_name ?? '',
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Donor name'
            filter={{ type: 'text', placeholder: 'Filter donor name' }}
          />
        ),
        cell: ({ row }) => row.original.donor_name ?? '—',
      },
      {
        id: 'donor_email',
        accessorFn: (row) => row.donor_email ?? '',
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Donor email'
            filter={{ type: 'text', placeholder: 'Filter donor email' }}
          />
        ),
        cell: ({ row }) => row.original.donor_email ?? '—',
      },
      {
        id: 'public_display_name',
        accessorFn: (row) => row.public_display_name ?? '',
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Public name'
            filter={{ type: 'text', placeholder: 'Filter public name' }}
          />
        ),
        cell: ({ row }) => row.original.public_display_name ?? '—',
      },
      {
        id: 'amount_display',
        accessorFn: (row) => formatCurrency(row.amount_cents),
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Amount'
            filter={{ type: 'text', placeholder: 'Filter amount' }}
          />
        ),
        cell: ({ row }) => formatCurrency(row.original.amount_cents),
      },
      {
        id: 'covers_processing_fee',
        accessorFn: (row) => booleanLabel(row.covers_processing_fee),
        filterFn: exactFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Covers fee'
            filter={{ type: 'select', options: YES_NO_OPTIONS }}
          />
        ),
        cell: ({ row }) => (
          <Badge variant='outline'>
            {row.original.covers_processing_fee ? 'Yes' : 'No'}
          </Badge>
        ),
      },
      {
        id: 'processing_fee_display',
        accessorFn: (row) => formatCurrency(row.processing_fee_cents),
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Processing fee'
            filter={{ type: 'text', placeholder: 'Filter processing fee' }}
          />
        ),
        cell: ({ row }) => formatCurrency(row.original.processing_fee_cents),
      },
      {
        id: 'total_display',
        accessorFn: (row) => formatCurrency(row.total_charged_cents),
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Total charged'
            filter={{ type: 'text', placeholder: 'Filter total charged' }}
          />
        ),
        cell: ({ row }) => formatCurrency(row.original.total_charged_cents),
      },
      {
        id: 'is_monthly',
        accessorFn: (row) => booleanLabel(row.is_monthly),
        filterFn: exactFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Monthly'
            filter={{ type: 'select', options: YES_NO_OPTIONS }}
          />
        ),
        cell: ({ row }) => (
          <Badge variant='outline'>
            {row.original.is_monthly ? 'Monthly' : 'One-time'}
          </Badge>
        ),
      },
      {
        id: 'recurrence_status',
        accessorFn: (row) => row.recurrence_status ?? '',
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Recurrence status'
            filter={{ type: 'text', placeholder: 'Filter recurrence status' }}
          />
        ),
        cell: ({ row }) => row.original.recurrence_status ?? '—',
      },
      {
        id: 'next_charge_date',
        accessorFn: (row) => formatDate(row.next_charge_date),
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Next charge'
            filter={{ type: 'text', placeholder: 'Filter next charge date' }}
          />
        ),
        cell: ({ row }) => formatDate(row.original.next_charge_date),
      },
      {
        id: 'donation_status',
        accessorKey: 'donation_status',
        filterFn: exactFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Donation status'
            filter={{ type: 'select', options: DONATION_STATUS_OPTIONS }}
          />
        ),
        cell: ({ row }) => (
          <Badge variant='outline'>{row.original.donation_status}</Badge>
        ),
      },
      {
        id: 'show_amount',
        accessorFn: (row) => booleanLabel(row.show_amount),
        filterFn: exactFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Show amount'
            filter={{ type: 'select', options: YES_NO_OPTIONS }}
          />
        ),
        cell: ({ row }) => (
          <Badge variant='outline'>
            {row.original.show_amount ? 'Yes' : 'No'}
          </Badge>
        ),
      },
      {
        id: 'is_anonymous',
        accessorFn: (row) => booleanLabel(row.is_anonymous),
        filterFn: exactFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Anonymous'
            filter={{ type: 'select', options: YES_NO_OPTIONS }}
          />
        ),
        cell: ({ row }) => (
          <Badge variant='outline'>
            {row.original.is_anonymous ? 'Yes' : 'No'}
          </Badge>
        ),
      },
      {
        id: 'created_at_display',
        accessorFn: (row) => formatDateTime(row.created_at),
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Created'
            filter={{ type: 'text', placeholder: 'Filter created date' }}
          />
        ),
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        id: 'message',
        accessorFn: (row) => row.message ?? '',
        filterFn: textFilter,
        header: ({ column }) => (
          <SupportWallColumnHeader
            column={column}
            title='Message'
            filter={{ type: 'text', placeholder: 'Filter message' }}
          />
        ),
        cell: ({ row }) => (
          <div className='max-w-md whitespace-pre-wrap'>
            {row.original.message || '—'}
          </div>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <div className='text-right'>Actions</div>,
        cell: ({ row }) => (
          <div className='flex justify-end gap-2'>
            {renderEntryActions(row.original)}
          </div>
        ),
      },
    ],
    [renderEntryActions]
  )

  const table = useReactTable({
    data: data?.entries ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 25,
      },
    },
  })

  if (!npoId || isLoading) {
    return <Skeleton className='h-72 w-full' />
  }

  if (isError) {
    return (
      <Card className='border-slate-800 bg-slate-950 text-slate-50 shadow-lg'>
        <CardContent className='p-6 text-sm'>
          Failed to load support wall donations.
          {error instanceof Error ? ` ${error.message}` : ''}
        </CardContent>
      </Card>
    )
  }

  const loadedCount = data?.entries.length ?? 0
  const totalCount = data?.total ?? 0
  const activeFilterCount = columnFilters.length
  const visibleRows = table.getRowModel().rows
  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const selectedEntryIds = selectedRows.map((row) => row.original.id)
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => row.getIsSelected())

  return (
    <Card className='border-slate-800 bg-slate-950 text-slate-50 shadow-lg'>
      <CardHeader className='border-b border-slate-800'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='space-y-1'>
            <CardTitle>Support Wall Donations</CardTitle>
            <CardDescription className='text-slate-300'>
              Showing {visibleRows.length} of {totalCount} donations loaded for
              moderation.
            </CardDescription>
            {totalCount > loadedCount && (
              <p className='text-xs text-slate-400'>
                Refine the backend page size if you expect more than 100 support
                wall donations at once.
              </p>
            )}
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <DataTableViewToggle value={viewMode} onChange={setViewMode} />
            <Button
              variant='outline'
              size='sm'
              onClick={() =>
                allVisibleSelected
                  ? table.toggleAllPageRowsSelected(false)
                  : table.toggleAllPageRowsSelected(true)
              }
              disabled={visibleRows.length === 0}
            >
              {allVisibleSelected
                ? 'Clear Page Selection'
                : 'Select All Visible'}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => bulkApproveMutation.mutate(selectedEntryIds)}
              disabled={selectedCount === 0 || bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <CheckCircle2 className='mr-2 h-4 w-4' />
              )}
              Approve Selected
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => bulkHideMutation.mutate(selectedEntryIds)}
              disabled={selectedCount === 0 || bulkHideMutation.isPending}
            >
              {bulkHideMutation.isPending ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <EyeOff className='mr-2 h-4 w-4' />
              )}
              Hide Selected
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='text-slate-200 hover:bg-slate-800 hover:text-white'
              onClick={() => table.resetColumnFilters()}
              disabled={activeFilterCount === 0}
            >
              Clear Filters
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>
        </div>
        {selectedCount > 0 && (
          <p className='text-sm text-slate-300'>
            {selectedCount} donation{selectedCount === 1 ? '' : 's'} selected
          </p>
        )}
      </CardHeader>

      <CardContent className='space-y-4 pt-6'>
        {viewMode === 'card' ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {visibleRows.length === 0 ? (
              <div className='text-muted-foreground bg-background col-span-full flex h-24 items-center justify-center rounded-md border border-slate-800 text-sm'>
                No support wall donations match the current filters.
              </div>
            ) : (
              visibleRows.map((row) => {
                const entry = row.original

                return (
                  <div
                    key={entry.id}
                    className='bg-background space-y-4 rounded-lg border border-slate-800 p-4 shadow-sm'
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div className='flex items-start gap-3'>
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) =>
                            row.toggleSelected(!!value)
                          }
                          aria-label='Select card'
                        />
                        <div className='space-y-2'>
                          <div className='text-base font-medium'>
                            {entry.donor_name ?? 'Unknown donor'}
                          </div>
                          <div className='flex flex-wrap gap-2'>
                            {renderModerationBadge(entry)}
                            <Badge variant='outline'>
                              {entry.is_monthly ? 'Monthly' : 'One-time'}
                            </Badge>
                            <Badge variant='outline'>
                              {entry.donation_status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className='flex flex-wrap justify-end gap-2'>
                        {renderEntryActions(entry)}
                      </div>
                    </div>

                    <div className='grid gap-3 text-sm sm:grid-cols-2'>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Public name
                        </div>
                        <div>{entry.public_display_name ?? '—'}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Donor email
                        </div>
                        <div className='truncate'>
                          {entry.donor_email ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Amount
                        </div>
                        <div>{formatCurrency(entry.amount_cents)}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Total charged
                        </div>
                        <div>{formatCurrency(entry.total_charged_cents)}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Processing fee
                        </div>
                        <div>{formatCurrency(entry.processing_fee_cents)}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Next charge
                        </div>
                        <div>{formatDate(entry.next_charge_date)}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Recurrence status
                        </div>
                        <div>{entry.recurrence_status ?? '—'}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Created
                        </div>
                        <div>{formatDateTime(entry.created_at)}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Anonymous
                        </div>
                        <div>{entry.is_anonymous ? 'Yes' : 'No'}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Show amount
                        </div>
                        <div>{entry.show_amount ? 'Yes' : 'No'}</div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          Covers fee
                        </div>
                        <div>{entry.covers_processing_fee ? 'Yes' : 'No'}</div>
                      </div>
                    </div>

                    <div className='space-y-1 border-t pt-3 text-sm'>
                      <div className='text-muted-foreground text-xs'>
                        Support wall message
                      </div>
                      <div className='whitespace-pre-wrap'>
                        {entry.message || '—'}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className='bg-background overflow-hidden rounded-md border border-slate-800'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {visibleRows.length > 0 ? (
                  visibleRows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='h-24 text-center'
                    >
                      No support wall donations match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <DataTablePagination table={table} />
      </CardContent>
    </Card>
  )
}
