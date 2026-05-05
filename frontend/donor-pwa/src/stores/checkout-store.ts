/**
 * Checkout Zustand store — T010
 *
 * Persists donor's in-progress checkout preferences across page loads.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CheckoutState {
  paymentMethod: 'card' | 'cash' | 'check' | 'daf'
  auctioneerTipCents: number
  platformTipCents: number
  coverProcessingFee: boolean
  acknowledgedItemsUpdatedAt: string | null

  setPaymentMethod: (method: 'card' | 'cash' | 'check' | 'daf') => void
  setAuctioneerTipCents: (cents: number) => void
  setPlatformTipCents: (cents: number) => void
  setCoverProcessingFee: (cover: boolean) => void
  setAcknowledgedItemsUpdatedAt: (ts: string | null) => void
  reset: () => void
}

const defaultState = {
  paymentMethod: 'card' as const,
  auctioneerTipCents: 5000,
  platformTipCents: 0,
  coverProcessingFee: false,
  acknowledgedItemsUpdatedAt: null,
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      ...defaultState,

      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setAuctioneerTipCents: (cents) => set({ auctioneerTipCents: cents }),
      setPlatformTipCents: (cents) => set({ platformTipCents: cents }),
      setCoverProcessingFee: (cover) => set({ coverProcessingFee: cover }),
      setAcknowledgedItemsUpdatedAt: (ts) =>
        set({ acknowledgedItemsUpdatedAt: ts }),
      reset: () => set(defaultState),
    }),
    {
      name: 'fundrbolt-checkout',
    }
  )
)
