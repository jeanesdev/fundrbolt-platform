import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Heart, X } from 'lucide-react'
import { triggerCelebrationConfetti } from '@/lib/celebration-confetti'
import { Button } from '@/components/ui/button'

interface SurveyThankYouPopupProps {
  open: boolean
  discountCents: number
  npoName: string | null
  onDonateBack: () => void
  onApply: () => void
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

export function SurveyThankYouPopup({
  open,
  discountCents,
  npoName,
  onDonateBack,
  onApply,
}: SurveyThankYouPopupProps) {
  const [donateClicked, setDonateClicked] = useState(false)

  useEffect(() => {
    if (open) {
      triggerCelebrationConfetti()
    }
  }, [open])

  const handleDonateBack = () => {
    setDonateClicked(true)
    onDonateBack()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onApply()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className='data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm' />
        <Dialog.Content className='data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none'>
          <Dialog.Close asChild>
            <button
              className='absolute top-4 right-4 rounded-sm text-gray-500 transition-colors hover:text-gray-900'
              aria-label='Close'
            >
              <X className='h-4 w-4' />
            </button>
          </Dialog.Close>

          <div className='flex flex-col items-center gap-4 text-center'>
            <div className='flex h-16 w-16 items-center justify-center rounded-full bg-green-100'>
              <Heart className='h-8 w-8 text-green-600' fill='currentColor' />
            </div>

            <div className='space-y-1'>
              <Dialog.Title className='text-xl font-bold text-gray-900'>
                Thank you! 🎉
              </Dialog.Title>
              <Dialog.Description className='text-sm text-gray-600'>
                Your preferences help us create a better experience for you.
              </Dialog.Description>
            </div>

            {discountCents > 0 && (
              <div className='w-full rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm'>
                <p className='font-semibold text-green-900'>
                  {formatDollars(discountCents)} survey discount earned!
                </p>
                <p className='text-green-800'>
                  This will be automatically applied at checkout.
                </p>
              </div>
            )}

            <div className='flex w-full flex-col gap-2'>
              {discountCents > 0 && npoName && !donateClicked && (
                <Button
                  variant='outline'
                  className='w-full gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800'
                  onClick={handleDonateBack}
                >
                  <Heart className='h-4 w-4 text-rose-500' />
                  Donate {formatDollars(discountCents)} back to {npoName}
                </Button>
              )}

              {donateClicked && (
                <div className='w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700'>
                  ❤️ Thank you for donating back to {npoName}!
                </div>
              )}

              <Button className='w-full' onClick={onApply}>
                Apply at checkout
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
