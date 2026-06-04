import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { useDonorLabels } from '@/features/users/hooks/use-donor-labels'
import { eventApi } from '@/services/event-service'
import {
  eventSurveyService,
  type SurveyConfig,
  type SurveyQuestion,
  type SurveyQuestionInput,
} from '@/services/eventSurveyService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

const emptyQuestion = (): SurveyQuestionInput => ({
  text: '',
  display_order: 0,
  is_active: true,
  allow_multiple: false,
  options: [
    { text: '', display_order: 0 },
    { text: '', display_order: 1 },
  ],
})

const labelMappingCopy: Record<string, string[]> = {
  'Impact Driven': [
    'measurable impact',
    'fund a proven program',
    'program outcomes',
    'families served',
  ],
  'Heart Driven': [
    'personal connection',
    'faith',
    'values',
    'family',
    'compassion',
    'faith impact',
  ],
  'Community Driven': [
    'community leadership',
    'join others',
    'community',
    'leadership',
    'community outreach',
  ],
  'Participation Driven': [
    'fun event experience',
    'bid',
    'invite friends',
    'volunteer',
  ],
}

function normalizeQuestion(question: SurveyQuestionInput): SurveyQuestionInput {
  return {
    ...question,
    text: question.text.trim(),
    options: question.options
      .map((option, index) => ({
        ...option,
        text: option.text.trim(),
        display_order: index,
        is_other: option.is_other ?? false,
      }))
      .filter((option) => option.text.length > 0),
  }
}

export function EventSurveyPage() {
  const queryClient = useQueryClient()
  const { currentEvent } = useEventWorkspace()
  const eventId = currentEvent.id
  const [draftQuestion, setDraftQuestion] =
    useState<SurveyQuestionInput>(emptyQuestion)
  const [copyFromEventId, setCopyFromEventId] = useState('')
  const [configDraft, setConfigDraft] = useState<SurveyConfig | null>(null)
  const [editingQuestions, setEditingQuestions] = useState<
    Record<string, SurveyQuestionInput>
  >({})

  const surveyQuery = useQuery({
    queryKey: ['event-survey', eventId],
    queryFn: () => eventSurveyService.getSurvey(eventId),
  })

  const siblingEventsQuery = useQuery({
    queryKey: ['event-list', currentEvent.npo_id, 'survey-copy'],
    queryFn: () =>
      eventApi.listEvents({
        npo_id: currentEvent.npo_id,
        page_size: 100,
      }),
  })

  const systemLabelsQuery = useDonorLabels(currentEvent.npo_id, {
    system_defaults_only: true,
  })

  const refreshSurvey = async () => {
    await queryClient.invalidateQueries({ queryKey: ['event-survey', eventId] })
  }

  const updateConfigMutation = useMutation({
    mutationFn: (payload: Partial<SurveyConfig>) =>
      eventSurveyService.updateSurvey(eventId, payload),
    onSuccess: () => refreshSurvey(),
    onError: () => toast.error('Failed to save survey settings'),
  })

  const resetDefaultsMutation = useMutation({
    mutationFn: () => eventSurveyService.resetDefaults(eventId),
    onSuccess: async () => {
      toast.success('Survey reset to default questions')
      setEditingQuestions({})
      await refreshSurvey()
    },
    onError: () => toast.error('Failed to reset survey questions'),
  })

  const copySurveyMutation = useMutation({
    mutationFn: (sourceEventId: string) =>
      eventSurveyService.copyFromEvent(eventId, sourceEventId),
    onSuccess: async () => {
      toast.success('Survey copied from selected event')
      setEditingQuestions({})
      await refreshSurvey()
    },
    onError: () => toast.error('Failed to copy survey'),
  })

  const createQuestionMutation = useMutation({
    mutationFn: (payload: SurveyQuestionInput) =>
      eventSurveyService.createQuestion(eventId, payload),
    onSuccess: async () => {
      toast.success('Question added')
      setDraftQuestion(emptyQuestion())
      await refreshSurvey()
    },
    onError: () => toast.error('Failed to add question'),
  })

  const updateQuestionMutation = useMutation({
    mutationFn: ({
      questionId,
      payload,
    }: {
      questionId: string
      payload: SurveyQuestionInput
    }) => eventSurveyService.updateQuestion(eventId, questionId, payload),
    onSuccess: () => refreshSurvey(),
    onError: () => toast.error('Failed to update question'),
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) =>
      eventSurveyService.deleteQuestion(eventId, questionId),
    onSuccess: async () => {
      toast.success('Question deleted')
      await refreshSurvey()
    },
    onError: () => toast.error('Failed to delete question'),
  })

  const survey = surveyQuery.data

  useEffect(() => {
    if (survey) setConfigDraft(survey)
  }, [survey])
  const siblingEvents = useMemo(
    () =>
      (siblingEventsQuery.data?.items ?? []).filter(
        (event) => event.id !== eventId
      ),
    [eventId, siblingEventsQuery.data?.items]
  )

  const getQuestionDraft = (question: SurveyQuestion): SurveyQuestionInput =>
    editingQuestions[question.id] ?? {
      id: question.id,
      text: question.text,
      display_order: question.display_order,
      is_active: question.is_active,
      allow_multiple: question.allow_multiple,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        display_order: option.display_order,
        is_other: option.is_other,
      })),
    }

  const setQuestionDraft = (questionId: string, next: SurveyQuestionInput) => {
    setEditingQuestions((prev) => ({ ...prev, [questionId]: next }))
  }

  const isSaving =
    updateConfigMutation.isPending || updateQuestionMutation.isPending

  const handleSaveAll = async () => {
    if (!configDraft) return
    const promises: Promise<unknown>[] = []

    promises.push(
      updateConfigMutation.mutateAsync({
        is_active: configDraft.is_active,
        modal_prompt_title: configDraft.modal_prompt_title,
        modal_prompt_body: configDraft.modal_prompt_body,
        discount_cents: configDraft.discount_cents,
      })
    )

    for (const [questionId, payload] of Object.entries(editingQuestions)) {
      promises.push(
        updateQuestionMutation.mutateAsync({
          questionId,
          payload: normalizeQuestion(payload),
        })
      )
    }

    try {
      await Promise.all(promises)
      toast.success('Survey saved')
      setEditingQuestions({})
    } catch {
      // individual onError callbacks handle per-mutation toasts
    }
  }

  if (surveyQuery.isLoading || !survey || !configDraft) {
    return <div className='text-muted-foreground py-10'>Loading survey...</div>
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Attendee profile survey</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Modal title</label>
              <Input
                value={configDraft.modal_prompt_title}
                onChange={(event) =>
                  setConfigDraft((prev) =>
                    prev
                      ? { ...prev, modal_prompt_title: event.target.value }
                      : prev
                  )
                }
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                Discount amount ($)
              </label>
              <Input
                type='number'
                min={0}
                step={0.01}
                value={(configDraft.discount_cents / 100).toFixed(2)}
                onChange={(event) =>
                  setConfigDraft((prev) =>
                    prev
                      ? {
                        ...prev,
                        discount_cents: Math.round(
                          Number(event.target.value || 0) * 100
                        ),
                      }
                      : prev
                  )
                }
              />
            </div>
          </div>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Modal body</label>
            <Textarea
              value={configDraft.modal_prompt_body}
              onChange={(event) =>
                setConfigDraft((prev) =>
                  prev
                    ? { ...prev, modal_prompt_body: event.target.value }
                    : prev
                )
              }
              rows={3}
            />
          </div>
          <div className='flex flex-wrap items-center gap-4'>
            <label className='flex items-center gap-2 text-sm font-medium'>
              <Switch
                checked={configDraft.is_active}
                onCheckedChange={(checked) =>
                  setConfigDraft((prev) =>
                    prev ? { ...prev, is_active: checked } : prev
                  )
                }
              />
              Survey active
            </label>
            <Button
              type='button'
              variant='outline'
              onClick={() => resetDefaultsMutation.mutate()}
              disabled={resetDefaultsMutation.isPending}
            >
              <RefreshCcw className='mr-2 h-4 w-4' />
              Reset defaults
            </Button>
          </div>
          <div className='flex flex-wrap items-end gap-3 border-t pt-4'>
            <div className='min-w-64 flex-1 space-y-2'>
              <label className='text-sm font-medium'>
                Copy survey from another event
              </label>
              <select
                className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'
                value={copyFromEventId}
                onChange={(event) => setCopyFromEventId(event.target.value)}
              >
                <option value=''>Select event</option>
                {siblingEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type='button'
              variant='outline'
              disabled={!copyFromEventId || copySurveyMutation.isPending}
              onClick={() => copySurveyMutation.mutate(copyFromEventId)}
            >
              Copy survey
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Category mapping</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-2'>
          {(systemLabelsQuery.data?.items ?? []).map((label) => (
            <div key={label.id} className='rounded-md border p-4'>
              <div className='flex items-center gap-2'>
                <span
                  className='inline-block h-3 w-3 rounded-full'
                  style={
                    label.color ? { backgroundColor: label.color } : undefined
                  }
                />
                <p className='font-medium'>{label.name}</p>
              </div>
              <p className='text-muted-foreground mt-2 text-sm'>
                Suggested when answers include keywords like:
              </p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {(labelMappingCopy[label.name] ?? []).map((keyword) => (
                  <span
                    key={keyword}
                    className='bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs'
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className='space-y-4'>
        {survey.questions
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((question) => {
            const draft = getQuestionDraft(question)
            return (
              <Card key={question.id}>
                <CardHeader className='flex flex-row items-center justify-between gap-4 space-y-0'>
                  <CardTitle className='text-base'>
                    Question {question.display_order + 1}
                  </CardTitle>
                  <div className='flex items-center gap-2'>
                    <label className='flex items-center gap-2 text-sm'>
                      <Switch
                        checked={draft.is_active ?? true}
                        onCheckedChange={(checked) =>
                          setQuestionDraft(question.id, {
                            ...draft,
                            is_active: checked,
                          })
                        }
                      />
                      Active
                    </label>
                    <label className='flex items-center gap-2 text-sm'>
                      <Switch
                        checked={draft.allow_multiple ?? false}
                        onCheckedChange={(checked) =>
                          setQuestionDraft(question.id, {
                            ...draft,
                            allow_multiple: checked,
                          })
                        }
                      />
                      Multi-select
                    </label>
                    <Button
                      type='button'
                      variant='destructive'
                      size='sm'
                      onClick={() => deleteQuestionMutation.mutate(question.id)}
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid gap-4 md:grid-cols-[1fr_120px]'>
                    <div className='space-y-2'>
                      <label className='text-sm font-medium'>
                        Question text
                      </label>
                      <Input
                        value={draft.text}
                        onChange={(event) =>
                          setQuestionDraft(question.id, {
                            ...draft,
                            text: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className='space-y-2'>
                      <label className='text-sm font-medium'>
                        Display order
                      </label>
                      <Input
                        type='number'
                        min={0}
                        value={draft.display_order}
                        onChange={(event) =>
                          setQuestionDraft(question.id, {
                            ...draft,
                            display_order: Number(event.target.value || 0),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>Options</label>
                    <div className='space-y-2'>
                      {draft.options.map((option, index) => (
                        <div key={option.id ?? index} className='flex gap-2'>
                          <Input
                            value={option.text}
                            placeholder={option.is_other ? 'Other (label shown to donor)' : ''}
                            onChange={(event) => {
                              const nextOptions = [...draft.options]
                              nextOptions[index] = {
                                ...option,
                                text: event.target.value,
                              }
                              setQuestionDraft(question.id, {
                                ...draft,
                                options: nextOptions,
                              })
                            }}
                          />
                          {option.is_other && (
                            <span className='bg-muted text-muted-foreground self-center rounded px-2 py-1 text-xs font-medium whitespace-nowrap'>
                              Other
                            </span>
                          )}
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={draft.options.length <= 2}
                            onClick={() => {
                              const nextOptions = draft.options.filter(
                                (_, i) => i !== index
                              )
                              setQuestionDraft(question.id, {
                                ...draft,
                                options: nextOptions,
                              })
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          setQuestionDraft(question.id, {
                            ...draft,
                            options: [
                              ...draft.options,
                              { text: '', display_order: draft.options.length },
                            ],
                          })
                        }
                      >
                        <Plus className='mr-2 h-4 w-4' />
                        Add option
                      </Button>
                      {draft.options.some((o) => o.is_other) ? (
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() =>
                            setQuestionDraft(question.id, {
                              ...draft,
                              options: draft.options.filter(
                                (o) => !o.is_other
                              ),
                            })
                          }
                        >
                          Remove "Other" option
                        </Button>
                      ) : (
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() =>
                            setQuestionDraft(question.id, {
                              ...draft,
                              options: [
                                ...draft.options,
                                {
                                  text: 'Other',
                                  display_order: draft.options.length,
                                  is_other: true,
                                },
                              ],
                            })
                          }
                        >
                          <Plus className='mr-2 h-4 w-4' />
                          Add "Other" option
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Add question</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-[1fr_120px]'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Question text</label>
              <Input
                value={draftQuestion.text}
                onChange={(event) =>
                  setDraftQuestion((prev) => ({
                    ...prev,
                    text: event.target.value,
                  }))
                }
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Display order</label>
              <Input
                type='number'
                min={0}
                value={draftQuestion.display_order}
                onChange={(event) =>
                  setDraftQuestion((prev) => ({
                    ...prev,
                    display_order: Number(event.target.value || 0),
                  }))
                }
              />
            </div>
          </div>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Options</label>
            {draftQuestion.options.map((option, index) => (
              <div key={index} className='flex gap-2'>
                <Input
                  value={option.text}
                  placeholder={option.is_other ? 'Other (label shown to donor)' : ''}
                  onChange={(event) => {
                    const nextOptions = [...draftQuestion.options]
                    nextOptions[index] = { ...option, text: event.target.value }
                    setDraftQuestion((prev) => ({
                      ...prev,
                      options: nextOptions,
                    }))
                  }}
                />
                {option.is_other && (
                  <span className='bg-muted text-muted-foreground self-center rounded px-2 py-1 text-xs font-medium whitespace-nowrap'>
                    Other
                  </span>
                )}
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={draftQuestion.options.length <= 2}
                  onClick={() =>
                    setDraftQuestion((prev) => ({
                      ...prev,
                      options: prev.options.filter(
                        (_, optionIndex) => optionIndex !== index
                      ),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() =>
                  setDraftQuestion((prev) => ({
                    ...prev,
                    options: [
                      ...prev.options,
                      { text: '', display_order: prev.options.length },
                    ],
                  }))
                }
              >
                <Plus className='mr-2 h-4 w-4' />
                Add option
              </Button>
              {draftQuestion.options.some((o) => o.is_other) ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    setDraftQuestion((prev) => ({
                      ...prev,
                      options: prev.options.filter((o) => !o.is_other),
                    }))
                  }
                >
                  Remove "Other" option
                </Button>
              ) : (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() =>
                    setDraftQuestion((prev) => ({
                      ...prev,
                      options: [
                        ...prev.options,
                        {
                          text: 'Other',
                          display_order: prev.options.length,
                          is_other: true,
                        },
                      ],
                    }))
                  }
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Add "Other" option
                </Button>
              )}
            </div>
          </div>
          <label className='flex items-center gap-2 text-sm font-medium'>
            <Switch
              checked={draftQuestion.allow_multiple ?? false}
              onCheckedChange={(checked) =>
                setDraftQuestion((prev) => ({ ...prev, allow_multiple: checked }))
              }
            />
            Allow multiple selections
          </label>
          <Button
            type='button'
            onClick={() =>
              createQuestionMutation.mutate(normalizeQuestion(draftQuestion))
            }
            disabled={createQuestionMutation.isPending}
          >
            <Plus className='mr-2 h-4 w-4' />
            Add question
          </Button>
        </CardContent>
      </Card>

      <div className='sticky bottom-0 z-10 border-t bg-background py-3 px-6 flex items-center justify-end gap-4'>
        {Object.keys(editingQuestions).length > 0 && (
          <span className='text-muted-foreground text-sm'>
            {Object.keys(editingQuestions).length} question
            {Object.keys(editingQuestions).length > 1 ? 's' : ''} with unsaved
            changes
          </span>
        )}
        <Button type='button' onClick={handleSaveAll} disabled={isSaving}>
          <Save className='mr-2 h-4 w-4' />
          {isSaving ? 'Saving...' : 'Save all changes'}
        </Button>
      </div>
    </div>
  )
}
