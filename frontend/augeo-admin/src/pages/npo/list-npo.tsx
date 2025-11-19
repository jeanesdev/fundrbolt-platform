/**
 * NPO List Page
 * Lists all NPOs with filtering, search, and pagination
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNpoContext } from '@/hooks/use-npo-context'
import { useNPOStore } from '@/stores/npo-store'
import type { NPOStatus } from '@/types/npo'
import { Link } from '@tanstack/react-router'
import { Building2, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

// Status color mapping
const statusColors = {
  draft: 'bg-gray-500',
  pending_approval: 'bg-yellow-500',
  approved: 'bg-green-500',
  suspended: 'bg-red-500',
  rejected: 'bg-red-700',
} as const

// Status label mapping
const statusLabels = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  suspended: 'Suspended',
  rejected: 'Rejected',
} as const

export default function NpoListPage() {
  const { npos, nposTotalCount, nposLoading, nposError, loadNPOs } = useNPOStore()
  const { selectedNpoId } = useNpoContext()

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Fetch NPOs on mount and when filters change
  useEffect(() => {
    loadNPOs({
      page,
      page_size: pageSize,
      search: searchQuery || undefined,
      ...(statusFilter !== 'all' && { status: statusFilter as NPOStatus }),
      ...(selectedNpoId && { npo_id: selectedNpoId }),
    })
  }, [page, searchQuery, statusFilter, loadNPOs, pageSize, selectedNpoId])  // Handle search with debounce
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(1) // Reset to first page on search
  }

  // Calculate pagination
  const totalPages = Math.ceil(nposTotalCount / pageSize)

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
            <p className="text-muted-foreground">
              Manage your non-profit organizations
            </p>
          </div>
        </div>
        <Link to="/npos/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Filter and search organizations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {nposLoading ? (
              'Loading...'
            ) : (
              <>
                Showing {npos.length} of {nposTotalCount} organization{nposTotalCount !== 1 ? 's' : ''}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {nposError && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">{nposError}</p>
          </CardContent>
        </Card>
      )}

      {/* NPO List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {nposLoading && npos.length === 0 ? (
          // Loading skeletons
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-3/4 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-2/3 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : npos.length === 0 ? (
          // Empty state
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No organizations found</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first organization'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Link to="/npos/create">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Organization
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          // NPO Cards
          npos.map((npo) => (
            <Card
              key={npo.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => {
                // Navigate to detail page
                window.location.href = `/npos/${npo.id}`
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{npo.name}</CardTitle>
                  <Badge
                    variant="secondary"
                    className={`${statusColors[npo.status as keyof typeof statusColors]} text-white`}
                  >
                    {statusLabels[npo.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-1">
                  {npo.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {npo.description || 'No description provided'}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {npo.member_count || 0} member{npo.member_count !== 1 ? 's' : ''}
                  </span>
                  <span>
                    Created {new Date(npo.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || nposLoading}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages || nposLoading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
