import { useMemo, useState } from 'react'
import { ArrowUpDown, Search, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEventSurveyAnswers } from '../hooks/useDonorDashboard'

interface SurveyAnswersTabProps {
  eventId?: string
  onSelectDonor: (userId: string) => void
}

export function SurveyAnswersTab({
  eventId,
  onSelectDonor,
}: SurveyAnswersTabProps) {
  const [sortByQuestionId, setSortByQuestionId] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [globalSearch, setGlobalSearch] = useState('')
  // key is question ID, or 'donor' for the name column
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  const params = useMemo(
    () => ({
      eventId: eventId ?? '',
      sort_by_question_id: sortByQuestionId || undefined,
      sort_order: sortOrder,
    }),
    [eventId, sortByQuestionId, sortOrder]
  )

  const query = useEventSurveyAnswers(params)

  const hasActiveFilters =
    globalSearch.trim() || Object.values(columnFilters).some((v) => v.trim())

  const filteredDonors = useMemo(() => {
    const donors = query.data?.donors ?? []
    const q = globalSearch.trim().toLowerCase()

    return donors.filter((donor) => {
      // Global search across name + all answers
      if (q) {
        const haystack = [donor.name, ...Object.values(donor.answers)]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      // Per-column filters
      for (const [colKey, filterVal] of Object.entries(columnFilters)) {
        const trimmed = filterVal.trim().toLowerCase()
        if (!trimmed) continue

        if (colKey === 'donor') {
          if (!donor.name.toLowerCase().includes(trimmed)) return false
        } else {
          const answer = (donor.answers[colKey] ?? '').toLowerCase()
          if (!answer.includes(trimmed)) return false
        }
      }

      return true
    })
  }, [query.data?.donors, globalSearch, columnFilters])

  const setColumnFilter = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearAllFilters = () => {
    setGlobalSearch('')
    setColumnFilters({})
  }

  if (!eventId) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Select an event to review attendee survey answers.
        </CardContent>
      </Card>
    )
  }

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Loading survey answers...
        </CardContent>
      </Card>
    )
  }

  if (query.isError || !query.data) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-destructive text-sm'>
            Unable to load survey answers.
          </p>
          <Button type='button' onClick={() => void query.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { questions } = query.data

  return (
    <Card>
      <CardHeader className='space-y-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>Survey Answers</CardTitle>
            <p className='text-muted-foreground mt-1 text-sm'>
              Review donor responses by question. Use column filters or the
              search bar to narrow results.
            </p>
          </div>
        </div>
        <div className='flex flex-wrap items-end gap-3'>
          {/* Global search */}
          <div className='relative min-w-56 flex-1'>
            <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
            <Input
              className='pl-8'
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder='Search donors and answers…'
            />
          </div>
          {/* Sort controls */}
          <div className='flex items-end gap-2'>
            <div className='space-y-1'>
              <label className='text-xs font-medium'>Sort by</label>
              <select
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={sortByQuestionId}
                onChange={(e) => setSortByQuestionId(e.target.value)}
              >
                <option value=''>Donor name</option>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text}
                  </option>
                ))}
              </select>
            </div>
            <select
              className='border-input bg-background h-9 rounded-md border px-3 text-sm'
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value === 'desc' ? 'desc' : 'asc')
              }
            >
              <option value='asc'>Asc</option>
              <option value='desc'>Desc</option>
            </select>
          </div>
          {hasActiveFilters && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={clearAllFilters}
              className='h-9 gap-1.5'
            >
              <X className='h-3.5 w-3.5' />
              Clear filters
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredDonors.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
            No survey responses match the current filters.
          </div>
        ) : (
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow className='align-top'>
                  <TableHead className='min-w-48'>
                    <div className='space-y-1.5'>
                      <span>Donor</span>
                      <Input
                        className='h-7 text-xs font-normal'
                        value={columnFilters['donor'] ?? ''}
                        onChange={(e) =>
                          setColumnFilter('donor', e.target.value)
                        }
                        placeholder='Filter…'
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </TableHead>
                  {questions.map((question) => (
                    <TableHead key={question.id} className='min-w-56 align-top'>
                      <div className='space-y-1.5'>
                        <div className='flex items-start gap-1.5'>
                          <ArrowUpDown className='text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
                          <span>{question.text}</span>
                        </div>
                        <Input
                          className='h-7 text-xs font-normal'
                          value={columnFilters[question.id] ?? ''}
                          onChange={(e) =>
                            setColumnFilter(question.id, e.target.value)
                          }
                          placeholder='Filter…'
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDonors.map((donor) => (
                  <TableRow key={donor.user_id}>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Avatar className='h-6 w-6 shrink-0'>
                          <AvatarFallback className='text-[10px]'>
                            {donor.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          type='button'
                          className='text-left font-medium underline-offset-4 hover:underline'
                          onClick={() => onSelectDonor(donor.user_id)}
                        >
                          {donor.name}
                        </button>
                      </div>
                    </TableCell>
                    {questions.map((question) => (
                      <TableCell key={`${donor.user_id}-${question.id}`}>
                        {donor.answers[question.id] ?? '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
