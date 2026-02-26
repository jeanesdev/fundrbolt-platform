import { useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { useLiveAuctionControls } from '../hooks/useLiveAuctionControls'
import { useLiveBidEntry } from '../hooks/useLiveBidEntry'
import { usePaddleRaiseEntry } from '../hooks/usePaddleRaiseEntry'
import { LiveBidEntryForm } from './LiveBidEntryForm'
import { LiveBidLogAndMetrics } from './LiveBidLogAndMetrics'
import { PaddleRaiseEntryForm } from './PaddleRaiseEntryForm'

export function QuickEntryPage() {
  const { eventId } = useParams({ from: '/_authenticated/events/$eventId/quick-entry' })
  const [mode, setMode] = useState<'LIVE_AUCTION' | 'PADDLE_RAISE'>('LIVE_AUCTION')
  const [selectedItemId, setSelectedItemId] = useState('')

  const {
    amount,
    bidderNumber,
    setAmount,
    setBidderNumber,
    submitBid,
    isSubmitting,
    submitToken,
  } =
    useLiveBidEntry(eventId, selectedItemId)

  const {
    summary,
    isLoadingSummary,
    isDeleting,
    isAssigningWinner,
    deleteBid,
    assignWinner,
  } = useLiveAuctionControls(eventId, selectedItemId)

  const {
    amount: paddleAmount,
    bidderNumber: paddleBidderNumber,
    selectedLabelIds,
    customLabel,
    labels,
    summary: paddleSummary,
    isSubmitting: isSubmittingPaddle,
    setAmount: setPaddleAmount,
    setBidderNumber: setPaddleBidderNumber,
    setCustomLabel,
    setSelectedLabelIds,
    submitDonation,
    submitToken: paddleSubmitToken,
  } = usePaddleRaiseEntry(eventId)

  return (
    <div className="space-y-2 p-4">
      <h1 className="text-xl font-semibold">Quick Entry</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="quick-entry-mode">
            Entry Mode
          </label>
          <select
            id="quick-entry-mode"
            className="w-full rounded-md border px-3 py-2"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'LIVE_AUCTION' | 'PADDLE_RAISE')}
          >
            <option value="LIVE_AUCTION">Live Auction</option>
            <option value="PADDLE_RAISE">Paddle Raise</option>
          </select>
        </div>

        {mode === 'LIVE_AUCTION' ? (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="quick-entry-item">
              Live Auction Item ID
            </label>
            <input
              id="quick-entry-item"
              className="w-full rounded-md border px-3 py-2"
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
              placeholder="Item UUID"
            />
          </div>
        ) : null}
      </div>

      {mode === 'LIVE_AUCTION' ? (
        <>
          <LiveBidEntryForm
            amount={amount}
            bidderNumber={bidderNumber}
            onAmountChange={setAmount}
            onBidderNumberChange={setBidderNumber}
            onSubmit={submitBid}
            disabled={isSubmitting}
            focusAmountToken={submitToken}
          />

          <LiveBidLogAndMetrics
            summary={summary}
            isLoading={isLoadingSummary}
            isDeleting={isDeleting}
            isAssigningWinner={isAssigningWinner}
            onDeleteBid={deleteBid}
            onAssignWinner={assignWinner}
          />
        </>
      ) : (
        <PaddleRaiseEntryForm
          amount={paddleAmount}
          bidderNumber={paddleBidderNumber}
          customLabel={customLabel}
          selectedLabelIds={selectedLabelIds}
          labels={labels}
          summary={paddleSummary}
          submitToken={paddleSubmitToken}
          disabled={isSubmittingPaddle}
          onAmountChange={setPaddleAmount}
          onBidderNumberChange={setPaddleBidderNumber}
          onCustomLabelChange={setCustomLabel}
          onSelectedLabelIdsChange={setSelectedLabelIds}
          onSubmit={submitDonation}
        />
      )}
    </div>
  )
}
