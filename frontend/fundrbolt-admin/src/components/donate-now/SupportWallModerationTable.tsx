import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { donateNowAdminApi } from '@/api/donateNow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface SupportWallModerationTableProps {
  npoId: string
}

export function SupportWallModerationTable({
  npoId,
}: SupportWallModerationTableProps) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['support-wall-admin', npoId],
    queryFn: () =>
      donateNowAdminApi
        .getSupportWall(npoId, { include_hidden: true, page_size: 50 })
        .then((r) => r.data),
  })

  const hideMutation = useMutation({
    mutationFn: (entryId: string) =>
      donateNowAdminApi.hideEntry(npoId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-wall-admin', npoId] })
      toast.success('Entry hidden')
    },
    onError: () => toast.error('Failed to hide entry'),
  })

  const restoreMutation = useMutation({
    mutationFn: (entryId: string) =>
      donateNowAdminApi.restoreEntry(npoId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-wall-admin', npoId] })
      toast.success('Entry restored')
    },
    onError: () => toast.error('Failed to restore entry'),
  })

  if (isLoading) {
    return <Skeleton className='h-48 w-full' />
  }

  const entries = data?.items ?? []

  return (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>
        {data?.total ?? 0} entries total. Hide entries that violate community
        guidelines.
      </p>

      {entries.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          No support wall entries yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Donor</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='w-24'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className={entry.is_hidden ? 'opacity-50' : ''}
              >
                <TableCell>
                  {entry.is_anonymous ? (
                    <span className='text-muted-foreground italic'>
                      Anonymous
                    </span>
                  ) : (
                    (entry.display_name ?? '—')
                  )}
                </TableCell>
                <TableCell className='max-w-xs truncate'>
                  {entry.message ?? '—'}
                </TableCell>
                <TableCell>
                  {entry.is_hidden ? (
                    <Badge variant='secondary'>Hidden</Badge>
                  ) : (
                    <Badge variant='outline'>Visible</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {entry.is_hidden ? (
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => restoreMutation.mutate(entry.id)}
                      disabled={restoreMutation.isPending}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => hideMutation.mutate(entry.id)}
                      disabled={hideMutation.isPending}
                    >
                      {hideMutation.isPending ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <EyeOff className='h-4 w-4' />
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
