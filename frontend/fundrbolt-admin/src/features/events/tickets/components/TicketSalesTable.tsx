/**
 * Ticket Sales Table
 * Displays searchable, sortable list of ticket purchases for an event
 */

import { salesTrackingApi, type EventSalesList } from '@/api/salesTracking';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
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

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, perPage, sortBy, sortDir]);

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

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
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

  const hasResults = (data?.sales?.length ?? 0) > 0;

  const paginationText = useMemo(() => {
    if (!totalCount) return 'No sales yet';
    const start = (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, totalCount);
    return `Showing ${start}-${end} of ${totalCount} sales`;
  }, [page, perPage, totalCount]);

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
              onChange={(event) => setQuery(event.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={String(perPage)}
            onValueChange={(value) => setPerPage(Number(value))}
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
          <div className="text-sm text-muted-foreground">No ticket sales found.</div>
        )}
        {!isLoading && !error && hasResults && (
          <div className="space-y-4">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('purchaser_name')}
                      >
                        Purchaser
                        {getSortIcon('purchaser_name')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('purchaser_email')}
                      >
                        Email
                        {getSortIcon('purchaser_email')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('package_name')}
                      >
                        Package
                        {getSortIcon('package_name')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('quantity')}
                      >
                        Qty
                        {getSortIcon('quantity')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('total_price')}
                      >
                        Total
                        {getSortIcon('total_price')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('payment_status')}
                      >
                        Status
                        {getSortIcon('payment_status')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('purchased_at')}
                      >
                        Purchased
                        {getSortIcon('purchased_at')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('promo_code')}
                      >
                        Promo
                        {getSortIcon('promo_code')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => toggleSort('external_sale_id')}
                      >
                        External ID
                        {getSortIcon('external_sale_id')}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.sales.map((sale) => (
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
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
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
