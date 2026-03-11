/**
 * SuperAdmin NPO Applications Page
 * Lists pending NPO applications with search, filter, and review actions
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import npoService from '@/services/npo-service'
import type { ApplicationStatus, NPOApplication } from '@/types/npo'
import {
  AlertCircle,
  Building2,
  ExternalLink,
  RotateCcw,
  Search,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { ApplicationReviewDialog } from '@/components/admin/application-review-dialog'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'

// Status badge color mapping
const statusColors: Record<ApplicationStatus, string> = {
  submitted: 'bg-yellow-500',
  under_review: 'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  reopened: 'bg-purple-500',
}

// Status label mapping
const statusLabels: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  reopened: 'Awaiting Revision',
}

export default function NPOApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>(
    'submitted'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedApplication, setSelectedApplication] =
    useState<NPOApplication | null>(null)
  const [reopenTarget, setReopenTarget] = useState<NPOApplication | null>(null)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [viewMode, setViewMode] = useViewPreference('npo-applications')
  const queryClient = useQueryClient()

  // Fetch applications
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'applications', statusFilter],
    queryFn: () =>
      npoService.admin.listApplications({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  })

  const reopenMutation = useMutation({
    mutationFn: (app: NPOApplication) =>
      npoService.admin.reopenApplication(
        app.npo_id,
        revisionNotes.trim() || undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
      setReopenTarget(null)
      setRevisionNotes('')
    },
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
    queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className='container mx-auto space-y-6 py-6'>
        <Skeleton className='h-12 w-64' />
        <Skeleton className='h-96 w-full' />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className='container mx-auto py-6'>
        <Card className='border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'>
          <CardContent className='pt-6'>
            <p className='text-sm text-red-600 dark:text-red-400'>
              {error instanceof Error
                ? error.message
                : 'Failed to load applications'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='container mx-auto space-y-6 py-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>NPO Applications</h1>
        <p className='text-muted-foreground'>
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
          <div className='flex flex-col gap-4 sm:flex-row'>
            <div className='relative flex-1'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder='Search by name, email, or ID...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-9'
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ApplicationStatus | 'all')
              }
            >
              <SelectTrigger className='w-full sm:w-[200px]'>
                <SelectValue placeholder='Filter by status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Statuses</SelectItem>
                <SelectItem value='submitted'>Submitted</SelectItem>
                <SelectItem value='under_review'>Under Review</SelectItem>
                <SelectItem value='approved'>Approved</SelectItem>
                <SelectItem value='rejected'>Rejected</SelectItem>
                <SelectItem value='reopened'>Awaiting Revision</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>
              Applications
              {filteredApplications && (
                <span className='text-muted-foreground ml-2 text-sm font-normal'>
                  ({filteredApplications.length}{' '}
                  {filteredApplications.length === 1 ? 'result' : 'results'})
                </span>
              )}
            </CardTitle>
            <DataTableViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </CardHeader>
        <CardContent>
          {!filteredApplications || filteredApplications.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12'>
              <Building2 className='text-muted-foreground mb-4 h-12 w-12' />
              <h3 className='mb-2 text-lg font-semibold'>
                No applications found
              </h3>
              <p className='text-muted-foreground text-sm'>
                {searchQuery
                  ? 'Try adjusting your search criteria'
                  : 'There are no applications to review at this time'}
              </p>
            </div>
          ) : viewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {filteredApplications.map((application) => (
                <div
                  key={application.id}
                  className='space-y-2 rounded-md border p-3'
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='truncate font-medium'>
                      {application.npo_name || 'Unknown'}
                    </span>
                    <div className='flex shrink-0 items-center gap-1'>
                      {application.is_overdue && (
                        <Badge
                          variant='secondary'
                          className='gap-1 bg-orange-500 text-white'
                        >
                          <AlertCircle className='h-3 w-3' />
                          Overdue
                        </Badge>
                      )}
                      <Badge
                        variant='secondary'
                        className={`${statusColors[application.status]} text-white`}
                      >
                        {statusLabels[application.status]}
                      </Badge>
                    </div>
                  </div>
                  <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                    <dt className='text-muted-foreground'>Email</dt>
                    <dd className='truncate'>
                      {application.npo_email || 'N/A'}
                    </dd>
                    <dt className='text-muted-foreground'>Submitted</dt>
                    <dd>
                      {new Date(application.submitted_at).toLocaleDateString()}
                    </dd>
                  </dl>
                  <div className='flex justify-end gap-2'>
                    <Link
                      to='/npos/$npoId'
                      params={{ npoId: application.npo_id }}
                    >
                      <Button size='sm' variant='outline'>
                        <ExternalLink className='mr-2 h-4 w-4' /> View Details
                      </Button>
                    </Link>
                    {application.status === 'submitted' ||
                    application.status === 'under_review' ? (
                      <Button
                        size='sm'
                        onClick={() => setSelectedApplication(application)}
                      >
                        Review
                      </Button>
                    ) : application.status === 'rejected' ? (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setReopenTarget(application)}
                      >
                        <RotateCcw className='mr-2 h-4 w-4' />
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setSelectedApplication(application)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell className='font-medium'>
                        {application.npo_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{application.npo_email || 'N/A'}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1.5'>
                          <Badge
                            variant='secondary'
                            className={`${statusColors[application.status]} text-white`}
                          >
                            {statusLabels[application.status]}
                          </Badge>
                          {application.is_overdue && (
                            <Badge
                              variant='secondary'
                              className='gap-1 bg-orange-500 text-white'
                            >
                              <AlertCircle className='h-3 w-3' />
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(
                          application.submitted_at
                        ).toLocaleDateString()}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Link
                            to='/npos/$npoId'
                            params={{ npoId: application.npo_id }}
                          >
                            <Button size='sm' variant='outline'>
                              <ExternalLink className='mr-2 h-4 w-4' />
                              View Details
                            </Button>
                          </Link>
                          {application.status === 'submitted' ||
                          application.status === 'under_review' ? (
                            <Button
                              size='sm'
                              onClick={() =>
                                setSelectedApplication(application)
                              }
                            >
                              Review
                            </Button>
                          ) : application.status === 'rejected' ? (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => setReopenTarget(application)}
                            >
                              <RotateCcw className='mr-2 h-4 w-4' />
                              Reopen
                            </Button>
                          ) : (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() =>
                                setSelectedApplication(application)
                              }
                            >
                              View
                            </Button>
                          )}
                        </div>
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

      {/* Reopen Dialog */}
      <Dialog
        open={!!reopenTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReopenTarget(null)
            setRevisionNotes('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Application for Revision</DialogTitle>
            <DialogDescription>
              This will notify <strong>{reopenTarget?.npo_name}</strong> that
              their application has been reopened and they can revise and
              resubmit it.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='revision-notes'>Revision guidance (optional)</Label>
            <Textarea
              id='revision-notes'
              placeholder='Describe what the applicant should change or improve...'
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className='text-muted-foreground text-right text-xs'>
              {revisionNotes.length}/1000
            </p>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setReopenTarget(null)
                setRevisionNotes('')
              }}
              disabled={reopenMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                reopenTarget && reopenMutation.mutate(reopenTarget)
              }
              disabled={reopenMutation.isPending}
            >
              {reopenMutation.isPending ? 'Reopening...' : 'Reopen Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
