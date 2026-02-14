/**
 * Ticket Sales Table
 * Displays searchable, sortable list of ticket purchases for an event
 */

import { salesTrackingApi, type EventSalesList } from '@/api/salesTracking';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface TicketSalesTableProps {
  eventId: string;
}

type SortDir = 'asc' | 'desc';

type SortableColumn =
  | 'purchased_at'
  | 'purchaser_name'
  | 'purchaser_email'
  | 'package_name'
  | 'quantity'
  | 'total_price'
  | 'payment_status'
  | 'promo_code'
  | 'external_sale_id';

type FilterState = {
  purchaser_name: string;
  purchaser_email: string;
  package_name: string;
  quantity: string;
  total_price: string;
  payment_status: string;
  purchased_at: string;
  promo_code: string;
  external_sale_id: string;
};

const DEFAULT_PER_PAGE = 25;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (amount: number) => currencyFormatter.format(Number(amount || 0));

const formatDate = (value: string) => new Date(value).toLocaleString();

const statusVariant = (status: string) => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'refunded':
      return 'outline';
    default:
      return 'secondary';
  }
};

export function TicketSalesTable({ eventId }: TicketSalesTableProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [sortBy, setSortBy] = useState<SortableColumn>('purchased_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
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
  });

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data, isLoading, error } = useQuery<EventSalesList>({
    queryKey: ['sales-list', eventId, debouncedQuery, sortBy, sortDir, page, perPage],
    queryFn: () =>
      salesTrackingApi.getEventSalesList(eventId, {
        search: debouncedQuery || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        per_page: perPage,
      }),
    enabled: Boolean(eventId),
  });

  const totalCount = data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const currentPage = Math.min(page, totalPages);

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      setPage(1);
    } else {
      setSortBy(column);
      setSortDir('desc');
      setPage(1);
    }
  };

  const getSortIcon = (column: SortableColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

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
    });
  };

  const sales = useMemo(() => data?.sales ?? [], [data?.sales]);
  const paymentStatuses = useMemo(
    () => Array.from(new Set(sales.map((sale) => sale.payment_status))).sort(),
    [sales]
  );
  const matchesText = (value: string | null | undefined, needle: string) =>
    value?.toLowerCase().includes(needle.toLowerCase()) ?? false;

  const filteredSales = useMemo(() => {
    if (!sales.length) return [];
    return sales.filter((sale) => {
      if (filters.purchaser_name && !matchesText(sale.purchaser_name, filters.purchaser_name)) {
        return false;
      }
      if (filters.purchaser_email && !matchesText(sale.purchaser_email, filters.purchaser_email)) {
        return false;
      }
      if (filters.package_name && !matchesText(sale.package_name, filters.package_name)) {
        return false;
      }
      if (
        filters.quantity &&
        !String(sale.quantity ?? '').includes(filters.quantity.trim())
      ) {
        return false;
      }
      if (
        filters.total_price &&
        !String(sale.total_price ?? '').includes(filters.total_price.trim())
      ) {
        return false;
      }
      if (filters.payment_status !== 'all' && sale.payment_status !== filters.payment_status) {
        return false;
      }
      if (filters.purchased_at) {
        const formatted = formatDate(sale.purchased_at);
        if (!matchesText(sale.purchased_at, filters.purchased_at) && !matchesText(formatted, filters.purchased_at)) {
          return false;
        }
      }
      if (filters.promo_code && !matchesText(sale.promo_code, filters.promo_code)) {
        return false;
      }
      if (filters.external_sale_id && !matchesText(sale.external_sale_id, filters.external_sale_id)) {
        return false;
      }
      return true;
    });
  }, [filters, sales]);

  const renderTextHeader = (
    label: string,
    column: SortableColumn,
    filterKey: keyof FilterState,
    placeholder: string
  ) => (
    <TableHead>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => toggleSort(column)}
        >
          {label}
          {getSortIcon(column)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
              aria-label={`Filter ${label}`}
            >
              <Filter className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => toggleSort(column)}>
              Toggle sort
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <div className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
              <Input
                placeholder={placeholder}
                value={filters[filterKey]}
                onChange={(event) => updateFilter(filterKey, event.target.value)}
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
  );

  const renderOptionHeader = (
    label: string,
    column: SortableColumn,
    filterKey: keyof FilterState,
    options: Array<{ value: string; label: string }>
  ) => (
    <TableHead>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => toggleSort(column)}
        >
          {label}
          {getSortIcon(column)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
              aria-label={`Filter ${label}`}
            >
              <Filter className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
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
  );

  const hasResults = filteredSales.length > 0;

  const paginationText = useMemo(() => {
    if (!totalCount) return 'No sales yet';
    const start = (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, totalCount);
    return `Showing ${start}-${end} of ${totalCount} sales`;
  }, [currentPage, perPage, totalCount]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>All Ticket Sales</CardTitle>
          <p className="text-sm text-muted-foreground">Search and sort every ticket purchase</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sales"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={String(perPage)}
            onValueChange={(value) => {
              setPerPage(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={Object.values(filters).every((value) => value === '' || value === 'all')}
          >
            Clear Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading sales...</div>
        )}
        {error && (
          <div className="text-sm text-destructive">Failed to load sales.</div>
        )}
        {!isLoading && !error && !hasResults && (
          <div className="text-sm text-muted-foreground">
            {sales.length === 0
              ? 'No ticket sales found.'
              : 'No ticket sales match the current filters.'}
          </div>
        )}
        {!isLoading && !error && hasResults && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredSales.length} of {sales.length} sales on this page
            </div>
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {renderTextHeader('Purchaser', 'purchaser_name', 'purchaser_name', 'Filter purchaser')}
                    {renderTextHeader('Email', 'purchaser_email', 'purchaser_email', 'Filter email')}
                    {renderTextHeader('Package', 'package_name', 'package_name', 'Filter package')}
                    {renderTextHeader('Qty', 'quantity', 'quantity', 'Filter quantity')}
                    {renderTextHeader('Total', 'total_price', 'total_price', 'Filter total')}
                    {renderOptionHeader(
                      'Status',
                      'payment_status',
                      'payment_status',
                      [{ value: 'all', label: 'All statuses' }].concat(
                        paymentStatuses.map((status) => ({ value: status, label: status }))
                      )
                    )}
                    {renderTextHeader('Purchased', 'purchased_at', 'purchased_at', 'Filter date')}
                    {renderTextHeader('Promo', 'promo_code', 'promo_code', 'Filter promo')}
                    {renderTextHeader('External ID', 'external_sale_id', 'external_sale_id', 'Filter external ID')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.purchase_id}>
                      <TableCell className="font-medium">{sale.purchaser_name || '—'}</TableCell>
                      <TableCell>{sale.purchaser_email || '—'}</TableCell>
                      <TableCell>{sale.package_name}</TableCell>
                      <TableCell className="text-right">{sale.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(sale.total_price))}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(sale.payment_status)}>
                          {sale.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(sale.purchased_at)}</TableCell>
                      <TableCell>
                        {sale.promo_code ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{sale.promo_code}</span>
                            {sale.discount_amount !== null && (
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(Number(sale.discount_amount))} off
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">{paginationText}</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
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
  );
}
