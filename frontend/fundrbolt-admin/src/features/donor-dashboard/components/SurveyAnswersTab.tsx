import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
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
  const [filterQuestionId, setFilterQuestionId] = useState<string>('')
  const [filterOptionText, setFilterOptionText] = useState('')

  const params = useMemo(
    () => ({
      eventId,
      sort_by_question_id: sortByQuestionId || undefined,
      sort_order: sortOrder,
      filter_question_id: filterQuestionId || undefined,
      filter_option_text: filterOptionText.trim() || undefined,
    }),
    [eventId, filterOptionText, filterQuestionId, sortByQuestionId, sortOrder]
  )

  const query = useEventSurveyAnswers(params)

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

  const { questions, donors } = query.data

  return (
    <Card>
      <CardHeader className='space-y-4'>
        <div>
          <CardTitle>Survey Answers</CardTitle>
          <p className='text-muted-foreground mt-1 text-sm'>
            Review donor responses by question, then sort or filter by any
            answer.
          </p>
        </div>
        <div className='grid gap-3 md:grid-cols-4'>
          <div className='space-y-1'>
            <label className='text-sm font-medium'>Sort by question</label>
            <select
              className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'
              value={sortByQuestionId}
              onChange={(event) => setSortByQuestionId(event.target.value)}
            >
              <option value=''>Donor name</option>
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.text}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <label className='text-sm font-medium'>Sort order</label>
            <select
              className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value === 'desc' ? 'desc' : 'asc')
              }
            >
              <option value='asc'>Ascending</option>
              <option value='desc'>Descending</option>
            </select>
          </div>
          <div className='space-y-1'>
            <label className='text-sm font-medium'>Filter question</label>
            <select
              className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'
              value={filterQuestionId}
              onChange={(event) => setFilterQuestionId(event.target.value)}
            >
              <option value=''>All questions</option>
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.text}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <label className='text-sm font-medium'>Answer contains</label>
            <Input
              value={filterOptionText}
              onChange={(event) => setFilterOptionText(event.target.value)}
              placeholder='e.g. leadership gift'
            />
          </div>
        </div>
        {(sortByQuestionId || filterQuestionId || filterOptionText) && (
          <div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                setSortByQuestionId('')
                setSortOrder('asc')
                setFilterQuestionId('')
                setFilterOptionText('')
              }}
            >
              Reset survey filters
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {donors.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
            No survey responses match the current filters.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='min-w-48'>Donor</TableHead>
                  {questions.map((question) => (
                    <TableHead key={question.id} className='min-w-56 align-top'>
                      <div className='flex items-start gap-2'>
                        <ArrowUpDown className='text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
                        <span>{question.text}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {donors.map((donor) => (
                  <TableRow key={donor.user_id}>
                    <TableCell>
                      <button
                        type='button'
                        className='text-left font-medium underline-offset-4 hover:underline'
                        onClick={() => onSelectDonor(donor.user_id)}
                      >
                        {donor.name}
                      </button>
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
