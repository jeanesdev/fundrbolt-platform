/**
 * ProcessingFeeConfig — T056
 *
 * Super-admin-only panel to view the current processing fee rate,
 * set a new rate, and browse the rate history.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getProcessingFeeConfig,
  getProcessingFeeHistory,
  setProcessingFeeRate,
} from '@/lib/api/checkout'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ProcessingFeeConfig() {
  const { isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [newRate, setNewRate] = useState('')

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['processing-fee-config'],
    queryFn: getProcessingFeeConfig,
    enabled: isSuperAdmin,
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['processing-fee-history'],
    queryFn: () => getProcessingFeeHistory(),
    enabled: isSuperAdmin,
  })

  const setRateMutation = useMutation({
    mutationFn: (rate: number) => setProcessingFeeRate(rate),
    onSuccess: (updated) => {
      queryClient.setQueryData(['processing-fee-config'], updated)
      void queryClient.invalidateQueries({
        queryKey: ['processing-fee-history'],
      })
      toast.success(`Processing fee rate set to ${updated.rate_pct}%`)
      setNewRate('')
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update processing fee'
      )
    },
  })

  if (!isSuperAdmin) return null

  return (
    <div className='space-y-6'>
      {/* Current rate */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Fee Rate</CardTitle>
          <CardDescription>
            Platform-wide processing fee applied to donor checkouts
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-3'>
            <span className='text-sm font-medium'>Current Rate:</span>
            {configLoading ? (
              <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
            ) : config ? (
              <Badge className='text-sm'>{config.rate_pct}%</Badge>
            ) : (
              <span className='text-muted-foreground text-sm'>Not set</span>
            )}
          </div>

          {/* Set new rate */}
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>Set New Rate</Label>
            <div className='flex max-w-xs items-center gap-2'>
              <div className='relative flex-1'>
                <Input
                  type='number'
                  min='0'
                  max='100'
                  step='0.1'
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder='e.g. 2.9'
                  className='h-8 pr-6 text-sm'
                />
                <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm'>
                  %
                </span>
              </div>
              <Button
                size='sm'
                className='h-8 shrink-0'
                disabled={!newRate || setRateMutation.isPending}
                onClick={() => {
                  const rate = parseFloat(newRate)
                  if (isNaN(rate) || rate < 0 || rate > 100) {
                    toast.error(
                      'Please enter a valid percentage between 0 and 100'
                    )
                    return
                  }
                  setRateMutation.mutate(rate)
                }}
              >
                {setRateMutation.isPending ? (
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                ) : (
                  'Set Rate'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Rate History</CardTitle>
          <CardDescription>
            Historical processing fee rates and when they were set
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className='flex justify-center py-6'>
              <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
            </div>
          ) : !history || history.history.length === 0 ? (
            <p className='text-muted-foreground py-4 text-center text-sm'>
              No rate history yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate</TableHead>
                  <TableHead>Set By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className='font-medium'>
                      {entry.rate_pct}%
                    </TableCell>
                    <TableCell className='text-muted-foreground text-sm'>
                      {entry.set_by ?? '—'}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-sm'>
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
