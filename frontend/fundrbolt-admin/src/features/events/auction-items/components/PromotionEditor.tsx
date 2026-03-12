/**
 * PromotionEditor Component
 * Allows editing promotion badge (with emoji + color) and notice for auction items
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { auctionEngagementService } from '@/services/auctionEngagementService'
import { BADGE_TEXT_ON_COLOR, PROMOTION_BADGE_COLORS } from '@/themes/colors'
import type { ItemPromotionUpdate } from '@/types/auction-engagement'
import type { AuctionItem } from '@/types/auction-item'
import { AlertCircle, Save, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PromotionEditorProps {
  eventId: string
  item: AuctionItem
  onCancel?: () => void
  onSuccess?: () => void
}

const PRESET_EMOJIS = [
  '🔥',
  '⭐',
  '💎',
  '🏆',
  '✨',
  '🎁',
  '💰',
  '🎉',
  '🌟',
  '❤️',
  '🎯',
  '🚀',
]

const PRESET_COLORS = PROMOTION_BADGE_COLORS

export function PromotionEditor({
  eventId,
  item,
  onCancel,
  onSuccess,
}: PromotionEditorProps) {
  const queryClient = useQueryClient()

  const itemWithPromotion = item as AuctionItem & {
    promotion_badge?: string | null
    promotion_badge_color?: string | null
    promotion_notice?: string | null
  }

  const [badge, setBadge] = useState<string>(
    itemWithPromotion.promotion_badge || ''
  )
  const [badgeColor, setBadgeColor] = useState<string>(
    itemWithPromotion.promotion_badge_color || ''
  )
  const [notice, setNotice] = useState<string>(
    itemWithPromotion.promotion_notice || ''
  )

  const updatePromotionMutation = useMutation({
    mutationFn: (data: ItemPromotionUpdate) =>
      auctionEngagementService.updatePromotion(eventId, item.id, data),
    onSuccess: () => {
      toast.success('Promotion updated successfully')
      queryClient.invalidateQueries({
        queryKey: ['auction-item', eventId, item.id],
      })
      queryClient.invalidateQueries({ queryKey: ['auction-items', eventId] })
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update promotion'
      )
    },
  })

  const handleSave = () => {
    const data: ItemPromotionUpdate = {
      badge_label: badge.trim() || null,
      badge_color: badgeColor || null,
      notice_message: notice.trim() || null,
    }
    updatePromotionMutation.mutate(data)
  }

  const handleClear = () => {
    setBadge('')
    setBadgeColor('')
    setNotice('')
  }

  const handleEmojiClick = (emoji: string) => {
    const hasEmoji = /^\p{Emoji}/u.test(badge.trim())
    if (hasEmoji) {
      setBadge(emoji + badge.replace(/^[\p{Emoji}\s]+/u, ''))
    } else {
      setBadge(emoji + (badge ? ' ' + badge : ''))
    }
  }

  const badgeLength = badge.length
  const noticeLength = notice.length
  const isBadgeTooLong = badgeLength > 50
  const isNoticeTooLong = noticeLength > 1000
  const isValid = !isBadgeTooLong && !isNoticeTooLong

  const badgeStyle = badgeColor
    ? {
        backgroundColor: badgeColor,
        color: BADGE_TEXT_ON_COLOR,
        borderColor: badgeColor,
      }
    : undefined

  return (
    <div className='space-y-4'>
      <div className='space-y-4'>
        {/* Badge text */}
        <div className='space-y-2'>
          <Label htmlFor='badge'>
            Promotion Badge{' '}
            <span className='text-muted-foreground'>(optional)</span>
          </Label>
          <Input
            id='badge'
            placeholder='e.g., Hot Item, Super Deal, Featured'
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            maxLength={60}
            className={isBadgeTooLong ? 'border-destructive' : ''}
          />
          <div className='flex items-center justify-between text-xs'>
            <span
              className={
                isBadgeTooLong ? 'text-destructive' : 'text-muted-foreground'
              }
            >
              {badgeLength}/50 characters
            </span>
            {isBadgeTooLong && (
              <span className='text-destructive flex items-center gap-1'>
                <AlertCircle className='h-3 w-3' />
                Too long
              </span>
            )}
          </div>
        </div>

        {/* Emoji picker */}
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Quick Emoji</Label>
          <div className='flex flex-wrap gap-1'>
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type='button'
                onClick={() => handleEmojiClick(emoji)}
                className='hover:bg-accent cursor-pointer rounded px-1 text-xl transition-transform hover:scale-125'
                title={`Use ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Badge Color</Label>
          <div className='flex flex-wrap items-center gap-2'>
            {PRESET_COLORS.map((color) => (
              <button
                key={color.label}
                type='button'
                title={color.label}
                onClick={() => setBadgeColor(color.value)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all hover:scale-110',
                  badgeColor === color.value
                    ? 'border-foreground ring-foreground scale-110 ring-2 ring-offset-1'
                    : 'border-border',
                  !color.value && 'bg-muted'
                )}
                style={
                  color.value ? { backgroundColor: color.value } : undefined
                }
              >
                {!color.value && (
                  <span className='text-muted-foreground text-xs'>∅</span>
                )}
              </button>
            ))}
          </div>
          <p className='text-muted-foreground text-xs'>
            {badgeColor
              ? `Color: ${PRESET_COLORS.find((c) => c.value === badgeColor)?.label ?? badgeColor}`
              : 'Default color'}
          </p>
        </div>

        {/* Notice */}
        <div className='space-y-2'>
          <Label htmlFor='notice'>
            Promotion Notice{' '}
            <span className='text-muted-foreground'>(optional)</span>
          </Label>
          <Textarea
            id='notice'
            placeholder='Special message shown to donors about this item...'
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            maxLength={1100}
            rows={4}
            className={isNoticeTooLong ? 'border-destructive' : ''}
          />
          <div className='flex items-center justify-between text-xs'>
            <span
              className={
                isNoticeTooLong ? 'text-destructive' : 'text-muted-foreground'
              }
            >
              {noticeLength}/1000 characters
            </span>
            {isNoticeTooLong && (
              <span className='text-destructive flex items-center gap-1'>
                <AlertCircle className='h-3 w-3' />
                Too long
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      <Card className='border-dashed'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-sm'>
            <Sparkles className='h-4 w-4' />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {badge && (
              <div>
                <Badge
                  variant='default'
                  style={badgeStyle}
                  className='font-semibold'
                >
                  {badge}
                </Badge>
              </div>
            )}
            {notice && (
              <p className='text-muted-foreground text-sm whitespace-pre-wrap'>
                {notice}
              </p>
            )}
            {!badge && !notice && (
              <p className='text-muted-foreground text-sm italic'>
                No promotion set. Add a badge or notice above to see preview.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className='flex items-center justify-between gap-2'>
        <Button
          variant='outline'
          onClick={handleClear}
          disabled={!badge && !notice && !badgeColor}
        >
          Clear All
        </Button>
        <div className='flex gap-2'>
          {onCancel && (
            <Button variant='ghost' onClick={onCancel}>
              <X className='mr-2 h-4 w-4' />
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!isValid || updatePromotionMutation.isPending}
          >
            <Save className='mr-2 h-4 w-4' />
            {updatePromotionMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
