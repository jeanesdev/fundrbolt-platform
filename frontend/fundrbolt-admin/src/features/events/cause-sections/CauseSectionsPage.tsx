import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCausePageCard,
  deleteCausePageCard,
  getCausePageCards,
  getCausePageConfig,
  getCausePageRevisions,
  publishCausePage,
  reorderCausePageCards,
  updateCausePageCard,
  type CauseSectionCard,
  type ConflictResponse,
  type CreateCardRequest,
  type PublishRequest,
} from '@/services/cause-section-cards'
import { Eye, Loader2, Plus, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, isErrorStatus } from '@/lib/error-utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEventWorkspace } from '../useEventWorkspace'
import { CardEditor } from './CardEditor'
import { CardList } from './CardList'
import { CauseSectionsPreview } from './CauseSectionsPreview'

function cardIdentity(card: CauseSectionCard) {
  return [
    card.card_type,
    card.built_in_section_key ?? '',
    card.display_order,
    card.title ?? '',
  ].join(':')
}

interface PendingConflict {
  detail: ConflictResponse
  retry: (draftVersion: number) => Promise<void>
}

interface CauseSectionsPageProps {
  embedded?: boolean
}

export function CauseSectionsPage({
  embedded = false,
}: CauseSectionsPageProps) {
  const { currentEvent } = useEventWorkspace()
  const eventId = currentEvent.id
  const queryClient = useQueryClient()

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedCardIdentity, setSelectedCardIdentity] = useState<
    string | null
  >(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [newCardType, setNewCardType] = useState<
    'text' | 'slideshow' | 'video'
  >('text')
  const [displayCards, setDisplayCards] = useState<CauseSectionCard[]>([])
  const isReorderInFlightRef = useRef(false)
  const reorderInFlightPromiseRef = useRef<Promise<void> | null>(null)
  const reorderSavedDraftVersionRef = useRef<number | null>(null)
  const [pendingConflict, setPendingConflict] =
    useState<PendingConflict | null>(null)

  const configQuery = useQuery({
    queryKey: ['cause-page-config', eventId],
    queryFn: () => getCausePageConfig(eventId),
  })

  const cardsQuery = useQuery({
    queryKey: ['cause-page-cards', eventId],
    queryFn: () => getCausePageCards(eventId),
  })

  const revisionsQuery = useQuery({
    queryKey: ['cause-page-revisions', eventId],
    queryFn: () => getCausePageRevisions(eventId),
  })

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['cause-page-config', eventId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['cause-page-cards', eventId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['cause-page-revisions', eventId],
      }),
    ])
  }

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data])
  const config = configQuery.data ?? null

  useEffect(() => {
    setDisplayCards(cards)
  }, [cards])

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  )

  useEffect(() => {
    if (!selectedCardId || !selectedCardIdentity || selectedCard) return
    const match = cards.find(
      (card) => cardIdentity(card) === selectedCardIdentity
    )
    if (match) {
      setSelectedCardId(match.id)
    }
  }, [cards, selectedCard, selectedCardId, selectedCardIdentity])

  const openEditor = (card: CauseSectionCard) => {
    setSelectedCardId(card.id)
    setSelectedCardIdentity(cardIdentity(card))
    setEditorOpen(true)
  }

  const handleConflict = (
    detail: ConflictResponse,
    retry: (draftVersion: number) => Promise<void>
  ) => {
    setPendingConflict({ detail, retry })
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateCardRequest) =>
      createCausePageCard(eventId, payload),
    onSuccess: async (card) => {
      await refreshAll()
      openEditor(card)
      setCreateDialogOpen(false)
      toast.success('Card created')
    },
    onError: (error) => {
      if (isErrorStatus(error, 409)) {
        const detail = (
          error as { response?: { data?: { detail?: ConflictResponse } } }
        ).response?.data?.detail
        if (detail) {
          handleConflict(detail, async (draftVersion) => {
            await createCausePageCard(eventId, {
              draft_version: draftVersion,
              card_type: newCardType,
              show_header: true,
              title: '',
            })
            await refreshAll()
          })
          return
        }
      }
      toast.error(getErrorMessage(error, 'Unable to create card'))
    },
  })

  const publishMutation = useMutation({
    mutationFn: (payload: PublishRequest) => publishCausePage(eventId, payload),
    onSuccess: async () => {
      await refreshAll()
      toast.success('Cause page published')
    },
    onError: (error) => {
      if (isErrorStatus(error, 409)) {
        const detail = (
          error as { response?: { data?: { detail?: ConflictResponse } } }
        ).response?.data?.detail
        if (detail) {
          handleConflict(detail, async (draftVersion) => {
            await publishCausePage(eventId, { draft_version: draftVersion })
            await refreshAll()
          })
          return
        }
      }
      toast.error(getErrorMessage(error, 'Unable to publish cause page'))
    },
  })

  const isLoading = configQuery.isLoading || cardsQuery.isLoading
  const hasUnsavedDraft =
    !!config && config.draft_version !== config.published_version

  const handleCreateCard = () => {
    if (!config) return
    createMutation.mutate({
      draft_version: config.draft_version,
      card_type: newCardType,
      title: '',
      show_header: true,
    })
  }

  const handleDeleteCard = async (
    card: CauseSectionCard,
    versionOverride?: number
  ) => {
    const draftVersion = versionOverride ?? config?.draft_version
    if (!draftVersion) return

    try {
      await deleteCausePageCard(eventId, card.id, {
        draft_version: draftVersion,
      })
      if (selectedCardId === card.id) {
        setEditorOpen(false)
        setSelectedCardId(null)
        setSelectedCardIdentity(null)
      }
      await refreshAll()
      toast.success('Card deleted')
    } catch (error) {
      if (isErrorStatus(error, 409)) {
        const detail = (
          error as { response?: { data?: { detail?: ConflictResponse } } }
        ).response?.data?.detail
        if (detail) {
          handleConflict(detail, (nextVersion) =>
            handleDeleteCard(card, nextVersion)
          )
          return
        }
      }
      toast.error(getErrorMessage(error, 'Unable to delete card'))
    }
  }

  const handleToggleCard = async (
    card: CauseSectionCard,
    isEnabled: boolean,
    versionOverride?: number
  ) => {
    const draftVersion = versionOverride ?? config?.draft_version
    if (!draftVersion) return

    try {
      const updated = await updateCausePageCard(eventId, card.id, {
        draft_version: draftVersion,
        is_enabled: isEnabled,
      })
      if (selectedCardIdentity === cardIdentity(card)) {
        setSelectedCardId(updated.id)
        setSelectedCardIdentity(cardIdentity(updated))
      }
      await refreshAll()
    } catch (error) {
      if (isErrorStatus(error, 409)) {
        const detail = (
          error as { response?: { data?: { detail?: ConflictResponse } } }
        ).response?.data?.detail
        if (detail) {
          handleConflict(detail, (nextVersion) =>
            handleToggleCard(card, isEnabled, nextVersion)
          )
          return
        }
      }
      toast.error(getErrorMessage(error, 'Unable to update visibility'))
    }
  }

  const handleReorderCards = async (
    cardIds: string[],
    versionOverride?: number
  ) => {
    const draftVersion = versionOverride ?? config?.draft_version
    if (!draftVersion) return

    const latestCardIds = cards.map((card) => card.id)
    const requestedCardIds = [...cardIds]
    const requestedCardIdSet = new Set(requestedCardIds)
    const reorderPayloadMatchesLatestDraft =
      latestCardIds.length === requestedCardIds.length &&
      requestedCardIdSet.size === requestedCardIds.length &&
      latestCardIds.every((cardId) => requestedCardIdSet.has(cardId))

    if (!reorderPayloadMatchesLatestDraft) {
      await refreshAll()
      toast.error('Card order changed. Please try again.')
      return
    }

    // Keep preview/list in sync with drag-drop intent immediately while request is in-flight.
    const requestedCardIndex = new Map(
      requestedCardIds.map((cardId, index) => [cardId, index])
    )
    isReorderInFlightRef.current = true
    setDisplayCards(
      [...cards].sort(
        (a, b) =>
          (requestedCardIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (requestedCardIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      )
    )

    const reorderOperation = (async () => {
      try {
        const reordered = await reorderCausePageCards(eventId, {
          draft_version: draftVersion,
          card_ids: requestedCardIds,
        })
        reorderSavedDraftVersionRef.current =
          reordered[0]?.draft_version ?? draftVersion

        if (selectedCardIdentity) {
          const match = reordered.find(
            (card) => cardIdentity(card) === selectedCardIdentity
          )
          if (match) setSelectedCardId(match.id)
        }
        await refreshAll()
        toast.success('Card order updated')
      } catch (_error) {
        // On any failure, refresh to get latest server state and let the user retry.
        // A reorder has no unsaved text content to preserve, so a conflict retry dialog
        // is not needed (and the stale card IDs in the closure would cause a second failure).
        await refreshAll()
        reorderSavedDraftVersionRef.current = null
        setDisplayCards(cards)
        toast.error('Card order changed. Please try again.')
      } finally {
        isReorderInFlightRef.current = false
      }
    })()

    reorderInFlightPromiseRef.current = reorderOperation
    await reorderOperation
    if (reorderInFlightPromiseRef.current === reorderOperation) {
      reorderInFlightPromiseRef.current = null
    }
  }

  const handlePublish = async () => {
    if (!config) return
    if (isReorderInFlightRef.current) {
      toast.info('Saving card order before publishing...')
      await reorderInFlightPromiseRef.current
      if (reorderSavedDraftVersionRef.current === null) {
        return
      }
    }

    publishMutation.mutate({
      draft_version:
        reorderSavedDraftVersionRef.current ?? config.draft_version,
    })
  }

  if (isLoading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {!embedded ? (
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-semibold'>Our Cause</h1>
            <p className='text-muted-foreground'>
              Build the donor-facing cause page for {currentEvent.name}.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {hasUnsavedDraft && (
              <Badge variant='secondary'>Unsaved draft</Badge>
            )}
            <Button
              variant='outline'
              onClick={() => setPreviewOpen((current) => !current)}
            >
              <Eye className='mr-2 h-4 w-4' />
              {previewOpen ? 'Hide Preview' : 'Preview'}
            </Button>
            <Button variant='outline' onClick={() => setCreateDialogOpen(true)}>
              <Plus className='mr-2 h-4 w-4' />
              Add Card
            </Button>
            <Button
              onClick={() => void handlePublish()}
              disabled={!config || publishMutation.isPending}
            >
              <UploadCloud className='mr-2 h-4 w-4' />
              Publish
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex flex-wrap items-center justify-end gap-2'>
          {hasUnsavedDraft && <Badge variant='secondary'>Unsaved draft</Badge>}
          <Button
            variant='outline'
            onClick={() => setPreviewOpen((current) => !current)}
          >
            <Eye className='mr-2 h-4 w-4' />
            {previewOpen ? 'Hide Preview' : 'Preview'}
          </Button>
          <Button variant='outline' onClick={() => setCreateDialogOpen(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Add Card
          </Button>
          <Button
            onClick={() => void handlePublish()}
            disabled={!config || publishMutation.isPending}
          >
            <UploadCloud className='mr-2 h-4 w-4' />
            Publish
          </Button>
        </div>
      )}

      <div className='grid gap-6 xl:grid-cols-[1.1fr_0.9fr]'>
        <Card>
          <CardHeader>
            <CardTitle>Ordered Cards</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <CardList
              cards={displayCards}
              onEdit={openEditor}
              onDelete={(card) => void handleDeleteCard(card)}
              onToggle={(card, enabled) => void handleToggleCard(card, enabled)}
              onReorder={(cardIds) => void handleReorderCards(cardIds)}
            />
          </CardContent>
        </Card>

        <div className='space-y-6'>
          {previewOpen && (
            <CauseSectionsPreview
              eventId={currentEvent.id}
              previewKey={displayCards
                .map((card) => `${card.id}:${card.is_enabled ? '1' : '0'}`)
                .join('|')}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Revision History</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {(revisionsQuery.data ?? []).slice(0, 6).map((revision) => (
                <div key={revision.id} className='rounded-lg border p-3'>
                  <p className='text-sm font-medium capitalize'>
                    {revision.action.replace(/_/g, ' ')}
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    Draft v{revision.draft_version} ·{' '}
                    {new Date(revision.changed_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cause Card</DialogTitle>
            <DialogDescription>
              Start with a text block, slideshow, or video section.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <Select
              value={newCardType}
              onValueChange={(value) =>
                setNewCardType(value as 'text' | 'slideshow' | 'video')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='text'>Text card</SelectItem>
                <SelectItem value='slideshow'>Slideshow card</SelectItem>
                <SelectItem value='video'>Video card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCard}
              disabled={createMutation.isPending}
            >
              Create Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingConflict !== null}
        onOpenChange={(open) => !open && setPendingConflict(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Concurrent draft change detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConflict?.detail.message}
              {pendingConflict?.detail.latest_change_summary && (
                <span className='mt-2 block'>
                  Latest server update:{' '}
                  {JSON.stringify(pendingConflict.detail.latest_change_summary)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                void refreshAll()
                setPendingConflict(null)
              }}
            >
              Discard my changes
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingConflict) return
                void pendingConflict.retry(
                  pendingConflict.detail.current_draft_version
                )
                setPendingConflict(null)
              }}
            >
              Keep my changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CardEditor
        eventId={eventId}
        eventMedia={currentEvent.media || []}
        card={selectedCard}
        config={config}
        open={editorOpen && !!selectedCard}
        onOpenChange={setEditorOpen}
        onConflict={handleConflict}
        onCardReplaced={(card) => {
          setSelectedCardId(card.id)
          setSelectedCardIdentity(cardIdentity(card))
        }}
        onRefresh={refreshAll}
      />
    </div>
  )
}
