import { type FormEvent, type KeyboardEvent, useEffect, useRef } from 'react'

interface LiveBidEntryFormProps {
  amount: string
  bidderNumber: string
  onAmountChange: (value: string) => void
  onBidderNumberChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  isSubmitting?: boolean
  focusAmountToken?: number
}

function parseToWholeDollar(value: string): string {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number.parseInt(digits, 10).toLocaleString('en-US')
}

export function LiveBidEntryForm({
  amount,
  bidderNumber,
  onAmountChange,
  onBidderNumberChange,
  onSubmit,
  disabled,
  isSubmitting,
  focusAmountToken,
}: LiveBidEntryFormProps) {
  const amountRef = useRef<HTMLInputElement>(null)
  const bidderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    amountRef.current?.focus()
    amountRef.current?.select()
  }, [focusAmountToken])

  const handleAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      bidderRef.current?.focus()
      bidderRef.current?.select()
    }
  }

  const handleBidderKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSubmit()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      amountRef.current?.focus()
      amountRef.current?.select()
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="grid grid-cols-2 gap-3" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="quick-entry-amount">
          Amount
        </label>
        <input
          id="quick-entry-amount"
          ref={amountRef}
          className="w-full rounded-md border px-3 py-2 h-12 text-lg"
          inputMode="numeric"
          value={amount}
          onChange={(event) => onAmountChange(parseToWholeDollar(event.target.value))}
          onKeyDown={handleAmountKeyDown}
          placeholder="1,000"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="quick-entry-bidder">
          Bidder Number
        </label>
        <input
          id="quick-entry-bidder"
          ref={bidderRef}
          className="w-full rounded-md border px-3 py-2 h-12 text-lg"
          inputMode="numeric"
          value={bidderNumber}
          onChange={(event) => onBidderNumberChange(event.target.value.replace(/[^\d]/g, ''))}
          onKeyDown={handleBidderKeyDown}
          placeholder="123"
          disabled={disabled}
        />
      </div>

      <div className="col-span-2">
        <button
          type="submit"
          className="bg-primary text-primary-foreground w-full rounded-md px-4 py-3 text-base font-medium disabled:cursor-not-allowed disabled:opacity-60 h-12"
          disabled={disabled}
        >
          {isSubmitting ? 'Submitting…' : 'Submit Bid'}
        </button>
      </div>
    </form>
  )
}
