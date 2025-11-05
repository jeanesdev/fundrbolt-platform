/**
 * SuperAdmin NPO Applications Page
 * Lists pending NPO applications with search, filter, and review actions
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApplicationReviewDialog } from '@/components/admin/application-review-dialog'
import npoService from '@/services/npo-service'
import type { ApplicationStatus, NPOApplication } from '@/types/npo'
import { useQuery } from '@tanstack/react-query'
import { Building2, Search } from 'lucide-react'
import { useState } from 'react'

// Status badge color mapping
const statusColors = {
  submitted: 'bg-yellow-500',
  under_review: 'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
} as const

// Status label mapping
const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
} as const

export default function NPOApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('submitted')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedApplication, setSelectedApplication] = useState<NPOApplication | null>(null)

  // Fetch applications
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'applications', statusFilter],
    queryFn: () =>
      npoService.admin.listApplications({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  })

  // Filter applications by search query
  const filteredApplications = data?.items.filter((app) => {
    const query = searchQuery.toLowerCase()
    return (
      app.npo_name?.toLowerCase().includes(query) ||
      app.npo_email?.toLowerCase().includes(query) ||
      app.id.toLowerCase().includes(query)
    )
  })

  const handleReviewComplete = () => {
    setSelectedApplication(null)
    refetch()
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : 'Failed to load applications'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NPO Applications</h1>
        <p className="text-muted-foreground">
          Review and manage pending organization applications
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter applications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as ApplicationStatus | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Applications
            {filteredApplications && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredApplications.length} {filteredApplications.length === 1 ? 'result' : 'results'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!filteredApplications || filteredApplications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No applications found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search criteria'
                  : 'There are no applications to review at this time'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell className="font-medium">
                        {application.npo_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{application.npo_email || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`${statusColors[application.status]} text-white`}
                        >
                          {statusLabels[application.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(application.submitted_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {application.status === 'submitted' ||
                        application.status === 'under_review' ? (
                          <Button
                            size="sm"
                            onClick={() => setSelectedApplication(application)}
                          >
                            Review
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedApplication(application)}
                          >
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      {selectedApplication && (
        <ApplicationReviewDialog
          application={selectedApplication}
          open={!!selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onReviewComplete={handleReviewComplete}
        />
      )}
    </div>
  )
}
