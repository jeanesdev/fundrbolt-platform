/**
 * ConsentHistory Component
 * Displays paginated table of user's consent acceptance history
 * Shows when user accepted terms/privacy policy and current status
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { consentService } from '@/services/consent-service'
import type { ConsentHistoryResponse } from '@/types/consent'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ConsentHistory() {
  const [history, setHistory] = useState<ConsentHistoryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const fetchHistory = async (page: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await consentService.getConsentHistory(page, pageSize)
      setHistory(data)
    } catch (_err) {
      setError('Failed to load consent history')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory(currentPage)
  }, [currentPage])

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (history && currentPage * pageSize < history.total) {
      setCurrentPage(currentPage + 1)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant='default'>Active</Badge>
      case 'superseded':
        return <Badge variant='secondary'>Superseded</Badge>
      case 'withdrawn':
        return <Badge variant='destructive'>Withdrawn</Badge>
      default:
        return <Badge variant='outline'>{status}</Badge>
    }
  }

  const totalPages = history ? Math.ceil(history.total / pageSize) : 0

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <FileText className='h-5 w-5 text-muted-foreground' />
          <CardTitle>Consent History</CardTitle>
        </div>
        <CardDescription>
          View your complete history of Terms of Service and Privacy Policy acceptances
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        )}

        {error && (
          <div className='rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive'>
            <p className='font-semibold'>Error</p>
            <p className='text-sm'>{error}</p>
          </div>
        )}

        {!isLoading && !error && history && history.consents.length === 0 && (
          <div className='rounded-lg border border-muted bg-muted/10 p-8 text-center'>
            <p className='text-muted-foreground'>No consent history found</p>
          </div>
        )}

        {!isLoading && !error && history && history.consents.length > 0 && (
          <>
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Accepted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Terms Version</TableHead>
                    <TableHead>Privacy Version</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.consents.map((consent) => {
                    const acceptedDate = new Date(consent.accepted_at)
                    const isValidDate = !isNaN(acceptedDate.getTime())

                    return (
                      <TableRow key={consent.id}>
                        <TableCell>
                          <div className='flex flex-col'>
                            <span className='font-medium'>
                              {isValidDate
                                ? acceptedDate.toLocaleDateString()
                                : 'Invalid date'}
                            </span>
                            <span className='text-xs text-muted-foreground'>
                              {isValidDate
                                ? formatDistanceToNow(acceptedDate, {
                                  addSuffix: true,
                                })
                                : 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(consent.status)}</TableCell>
                        <TableCell className='font-mono text-sm'>
                          {consent.tos_document_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className='font-mono text-sm'>
                          {consent.privacy_document_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground'>
                          N/A
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className='mt-4 flex items-center justify-between'>
              <div className='text-sm text-muted-foreground'>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, history.total)} of {history.total} entries
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className='h-4 w-4 mr-1' />
                  Previous
                </Button>
                <span className='text-sm text-muted-foreground'>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className='h-4 w-4 ml-1' />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
