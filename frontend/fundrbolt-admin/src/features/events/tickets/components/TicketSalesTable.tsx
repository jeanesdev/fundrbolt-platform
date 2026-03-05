/**
 * Ticket Sales Table
 * Displays searchable, sortable list of ticket purchases for an event
 */
import { salesTrackingApi, type EventSalesList } from '@/api/salesTracking'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useViewPreference } from '@/hooks/use-view-preference'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Filter,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface TicketSalesTableProps {
  eventId: string
}

type SortDir = 'asc' | 'desc'

type SortableColumn =
  | 'purchased_at'
  | 'purchaser_name'
  | 'purchaser_email'
  | 'package_name'
  | 'quantity'
  | 'total_price'
  | 'payment_status'
  | 'promo_code'
  | 'external_sale_id'

type FilterState = {
  purchaser_name: string
  purchaser_email: string
  package_name: string
  quantity: string
  total_price: string
  payment_status: string
  purchased_at: string
  promo_code: string
  external_sale_id: string
}

const DEFAULT_PER_PAGE = 25

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatCurrency = (amount: number) =>
  currencyFormatter.format(Number(amount || 0))

const formatDate = (value: string) => new Date(value).toLocaleString()

const statusVariant = (status: string) => {
  switch (status) {
    case 'completed':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'refunded':
      return 'outline'
    default:
      return 'secondary'
  }
}

export function TicketSalesTable({ eventId }: TicketSalesTableProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)
  const [sortBy, setSortBy] = useState<SortableColumn>('purchased_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useViewPreference('ticket-sales')
  const [filters, setFilters] = useState<FilterState>({
    purchaser_name: '',
    purchaser_email: '',
    package_name: '',
    quantity: '',
    total_price: '',
    payment_status: 'all',
    purchased_at: '',
    promo_code: '',
    external_sale_id: '',
  })
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false)

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([, v]) => v !== '' && v !== 'all').length,
    [filters]
  )

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timeout)
  }, [query])

  const { data, isLoading, error } = useQuery<EventSalesList>({
    queryKey: [
      'sales-list',
      eventId,
      debouncedQuery,
      sortBy,
      sortDir,
      page,
      perPage,
    ],
    queryFn: () =>
      salesTrackingApi.getEventSalesList(eventId, {
        search: debouncedQuery || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        per_page: perPage,
      }),
    enabled: Boolean(eventId),
  })

  const totalCount = data?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
  const currentPage = Math.min(page, totalPages)

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
      setPage(1)
    } else {
      setSortBy(column)
      setSortDir('desc')
      setPage(1)
    }
  }

  const getSortIcon = (column: SortableColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className='text-muted-foreground ml-2 h-4 w-4' />
    }
    return sortDir === 'asc' ? (
      <ArrowUp className='ml-2 h-4 w-4' />
    ) : (
      <ArrowDown className='ml-2 h-4 w-4' />
    )
  }

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({
      purchaser_name: '',
      purchaser_email: '',
      package_name: '',
      quantity: '',
      total_price: '',
      payment_status: 'all',
      purchased_at: '',
      promo_code: '',
      external_sale_id: '',
    })
  }

  const clearAllCardFilters = useCallback(() => {
    clearFilters()
    setCardFiltersOpen(false)
  }, [])

  const sales = useMemo(() => data?.sales ?? [], [data?.sales])
  const paymentStatuses = useMemo(
    () => Array.from(new Set(sales.map((sale) => sale.payment_status))).sort(),
    [sales]
  )
  const matchesText = (value: string | null | undefined, needle: string) =>
    value?.toLowerCase().includes(needle.toLowerCase()) ?? false

  const filteredSales = useMemo(() => {
    if (!sales.length) return []
    return sales.filter((sale) => {
      if (
        filters.purchaser_name &&
        !matchesText(sale.purchaser_name, filters.purchaser_name)
      ) {
        return false
      }
      if (
        filters.purchaser_email &&
        !matchesText(sale.purchaser_email, filters.purchaser_email)
      ) {
        return false
      }
      if (
        filters.package_name &&
        !matchesText(sale.package_name, filters.package_name)
      ) {
        return false
      }
      if (
        filters.quantity &&
        !String(sale.quantity ?? '').includes(filters.quantity.trim())
      ) {
        return false
      }
      if (
        filters.total_price &&
        !String(sale.total_price ?? '').includes(filters.total_price.trim())
      ) {
        return false
      }
      if (
        filters.payment_status !== 'all' &&
        sale.payment_status !== filters.payment_status
      ) {
        return false
      }
      if (filters.purchased_at) {
        const formatted = formatDate(sale.purchased_at)
        if (
          !matchesText(sale.purchased_at, filters.purchased_at) &&
          !matchesText(formatted, filters.purchased_at)
        ) {
          return false
        }
      }
      if (
        filters.promo_code &&
        !matchesText(sale.promo_code, filters.promo_code)
      ) {
        return false
      }
      if (
        filters.external_sale_id &&
        !matchesText(sale.external_sale_id, filters.external_sale_id)
      ) {
        return false
      }
      return true
    })
  }, [filters, sales])

  const renderTextHeader = (
    label: string,
    column: SortableColumn,
    filterKey: keyof FilterState,
    placeholder: string
  ) => (
    <TableHead>
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 px-2'
          onClick={() => toggleSort(column)}
        >
          {label}
          {getSortIcon(column)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground rounded-sm p-1'
              aria-label={`Filter ${label}`}
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => toggleSort(column)}>
              Toggle sort
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <div
              className='px-2 py-2'
              onClick={(event) => event.stopPropagation()}
            >
              <Input
                placeholder={placeholder}
                value={filters[filterKey]}
                onChange={(event) =>
                  updateFilter(filterKey, event.target.value)
                }
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>
            <DropdownMenuItem
              disabled={!filters[filterKey]}
              onSelect={() => updateFilter(filterKey, '')}
            >
              Clear filter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )

  const renderOptionHeader = (
    label: string,
    column: SortableColumn,
    filterKey: keyof FilterState,
    options: Array<{ value: string; label: string }>
  ) => (
    <TableHead>
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 px-2'
          onClick={() => toggleSort(column)}
        >
          {label}
          {getSortIcon(column)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground rounded-sm p-1'
              aria-label={`Filter ${label}`}
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => toggleSort(column)}>
              Toggle sort
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters[filterKey]}
              onValueChange={(value) => updateFilter(filterKey, value)}
            >
              {options.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )

  const hasResults = filteredSales.length > 0

  const paginationText = useMemo(() => {
    if (!totalCount) return 'No sales yet'
    const start = (currentPage - 1) * perPage + 1
    const end = Math.min(currentPage * perPage, totalCount)
    return `Showing ${start}-${end} of ${totalCount} sales`
  }, [currentPage, perPage, totalCount])

  return (
    <Card>
      <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <CardTitle>All Ticket Sales</CardTitle>
          <p className='text-muted-foreground text-sm'>
            Search and sort every ticket purchase
          </p>
        </div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <DataTableViewToggle value={viewMode} onChange={setViewMode} />
          <div className='relative w-full sm:w-64'>
            <Search className='text-muted-foreground absolute top-2.5 left-2 h-4 w-4' />
            <Input
              placeholder='Search sales'
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              className='pl-8'
            />
          </div>
          <Select
            value={String(perPage)}
            onValueChange={(value) => {
              setPerPage(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Rows' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='25'>25 rows</SelectItem>
              <SelectItem value='50'>50 rows</SelectItem>
              <SelectItem value='100'>100 rows</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant='ghost'
            size='sm'
            onClick={clearFilters}
            disabled={Object.values(filters).every(
              (value) => value === '' || value === 'all'
            )}
          >
            Clear Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className='text-muted-foreground text-sm'>Loading sales...</div>
        )}
        {error && (
          <div className='text-destructive text-sm'>Failed to load sales.</div>
        )}
        {!isLoading && !error && !hasResults && (
          <div className='text-muted-foreground text-sm'>
            {sales.length === 0
              ? 'No ticket sales found.'
              : 'No ticket sales match the current filters.'}
          </div>
        )}
        {!isLoading && !error && hasResults && (
          <div className='space-y-4'>
            <div className='text-muted-foreground text-sm'>
              Showing {filteredSales.length} of {sales.length} sales on this
              page
            </div>
            {viewMode === 'card' ? (
              <div className='space-y-3'>
                {/* Card view filter panel */}
                <div className='flex flex-wrap items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCardFiltersOpen((prev) => !prev)}
                  >
                    <Filter className='mr-1 h-4 w-4' />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant='secondary' className='ml-1'>
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                  {activeFilterCount > 0 && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={clearAllCardFilters}
                    >
                      <X className='mr-1 h-3 w-3' />
                      Clear all
                    </Button>
                  )}
                  <span className='text-muted-foreground ml-auto text-xs'>
                    {filteredSales.length} of {sales.length} sales
                  </span>
                </div>
                {cardFiltersOpen && (
                  <div className='bg-muted/30 rounded-md border p-3'>
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-purchaser' className='text-xs'>Purchaser</Label>
                        <Input
                          id='ticket-filter-purchaser'
                          placeholder='Filter purchaser…'
                          value={filters.purchaser_name}
                          onChange={(e) =>
                            updateFilter('purchaser_name', e.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-email' className='text-xs'>Email</Label>
                        <Input
                          id='ticket-filter-email'
                          placeholder='Filter email…'
                          value={filters.purchaser_email}
                          onChange={(e) =>
                            updateFilter('purchaser_email', e.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-package' className='text-xs'>Package</Label>
                        <Input
                          id='ticket-filter-package'
                          placeholder='Filter package…'
                          value={filters.package_name}
                          onChange={(e) =>
                            updateFilter('package_name', e.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-quantity' className='text-xs'>Quantity</Label>
                        <Input
                          id='ticket-filter-quantity'
                          placeholder='Filter quantity…'
                          value={filters.quantity}
                          onChange={(e) =>
                            updateFilter('quantity', e.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-total' className='text-xs'>Total</Label>
                        <Input
                          id='ticket-filter-total'
                          placeholder='Filter total…'
                          value={filters.total_price}
                          onChange={(e) =>
                            updateFilter('total_price', e.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-status' className='text-xs'>Status</Label>
                        <Select
                          value={filters.payment_status}
                          onValueChange={(v) =>
                            updateFilter('payment_status', v)
                          }
                        >
                          <SelectTrigger id='ticket-filter-status'>
                            <SelectValue placeholder='All statuses' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='all'>All statuses</SelectItem>
                            {paymentStatuses.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-purchased' className='text-xs'>Purchased</Label>
                        <Input
                          id='ticket-filter-purchased'
                          placeholder='Filter date…'
                          value={filters.purchased_at}
                          onChange={(e) =>
                            updateFilter('purchased_at', e.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-promo' className='text-xs'>Promo</Label>
                        <Input
                          id='ticket-filter-promo'
                          placeholder='Filter promo…'
                          value={filters.promo_code}
                          onChange={(e) =>
                            updateFilter('promo_code', e.target.value)
                          }
                        />
                      </div>
                      <div className='space-y-1'>
                        <Label htmlFor='ticket-filter-external' className='text-xs'>External ID</Label>
                        <Input
                          id='ticket-filter-external'
                          placeholder='Filter external ID…'
                          value={filters.external_sale_id}
                          onChange={(e) =>
                            updateFilter('external_sale_id', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {filteredSales.map((sale) => (
                    <div
                      key={sale.purchase_id}
                      className='space-y-2 rounded-md border p-3'
                    >
                      <div className='flex items-center justify-between'>
                        <span className='font-medium'>
                          {sale.purchaser_name || '—'}
                        </span>
                        <span className='font-semibold'>
                          {formatCurrency(Number(sale.total_price))}
                        </span>
                      </div>
                      <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                        <dt className='text-muted-foreground'>Package</dt>
                        <dd>{sale.package_name}</dd>
                        <dt className='text-muted-foreground'>Date</dt>
                        <dd>{formatDate(sale.purchased_at)}</dd>
                      </dl>
                      <Collapsible>
                        <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs'>
                          <ChevronDown className='h-3 w-3' />
                          More details
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <dl className='mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                            <dt className='text-muted-foreground'>Email</dt>
                            <dd className='truncate'>
                              {sale.purchaser_email || '—'}
                            </dd>
                            <dt className='text-muted-foreground'>Qty</dt>
                            <dd>{sale.quantity}</dd>
                            <dt className='text-muted-foreground'>Status</dt>
                            <dd>
                              <Badge
                                variant={statusVariant(sale.payment_status)}
                              >
                                {sale.payment_status}
                              </Badge>
                            </dd>
                            <dt className='text-muted-foreground'>Promo</dt>
                            <dd>{sale.promo_code || '—'}</dd>
                            <dt className='text-muted-foreground'>
                              External ID
                            </dt>
                            <dd>{sale.external_sale_id || '—'}</dd>
                          </dl>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className='w-full overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {renderTextHeader(
                        'Purchaser',
                        'purchaser_name',
                        'purchaser_name',
                        'Filter purchaser'
                      )}
                      {renderTextHeader(
                        'Email',
                        'purchaser_email',
                        'purchaser_email',
                        'Filter email'
                      )}
                      {renderTextHeader(
                        'Package',
                        'package_name',
                        'package_name',
                        'Filter package'
                      )}
                      {renderTextHeader(
                        'Qty',
                        'quantity',
                        'quantity',
                        'Filter quantity'
                      )}
                      {renderTextHeader(
                        'Total',
                        'total_price',
                        'total_price',
                        'Filter total'
                      )}
                      {renderOptionHeader(
                        'Status',
                        'payment_status',
                        'payment_status',
                        [{ value: 'all', label: 'All statuses' }].concat(
                          paymentStatuses.map((status) => ({
                            value: status,
                            label: status,
                          }))
                        )
                      )}
                      {renderTextHeader(
                        'Purchased',
                        'purchased_at',
                        'purchased_at',
                        'Filter date'
                      )}
                      {renderTextHeader(
                        'Promo',
                        'promo_code',
                        'promo_code',
                        'Filter promo'
                      )}
                      {renderTextHeader(
                        'External ID',
                        'external_sale_id',
                        'external_sale_id',
                        'Filter external ID'
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.purchase_id}>
                        <TableCell className='font-medium'>
                          {sale.purchaser_name || '—'}
                        </TableCell>
                        <TableCell>{sale.purchaser_email || '—'}</TableCell>
                        <TableCell>{sale.package_name}</TableCell>
                        <TableCell className='text-right'>
                          {sale.quantity}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatCurrency(Number(sale.total_price))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(sale.payment_status)}>
                            {sale.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(sale.purchased_at)}</TableCell>
                        <TableCell>
                          {sale.promo_code ? (
                            <div className='flex flex-col'>
                              <span className='font-medium'>
                                {sale.promo_code}
                              </span>
                              {sale.discount_amount !== null && (
                                <span className='text-muted-foreground text-xs'>
                                  {formatCurrency(Number(sale.discount_amount))}{' '}
                                  off
                                </span>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{sale.external_sale_id || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <div className='text-muted-foreground text-sm'>
                {paginationText}
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <span className='text-muted-foreground text-sm'>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
