/**
 * Ticket Cart Store
 *
 * Zustand store with localStorage persistence for managing
 * the donor's ticket shopping cart. Automatically clears when
 * switching events.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  packageId: string
  packageName: string
  unitPrice: number
  quantity: number
  seatsPerPackage: number
  isSponsorship: boolean
}

interface TicketCartState {
  items: CartItem[]
  eventId: string | null
  eventSlug: string | null
  promoCode: string | null

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  removeItem: (packageId: string) => void
  updateQuantity: (packageId: string, quantity: number) => void
  clearCart: () => void
  setPromoCode: (code: string | null) => void
  setEvent: (eventId: string, eventSlug: string) => void

  // Computed
  totalItems: () => number
  totalSeats: () => number
  subtotal: () => number
  hasSponsorship: () => boolean
}

export const useTicketCartStore = create<TicketCartState>()(
  persist(
    (set, get) => ({
      items: [],
      eventId: null,
      eventSlug: null,
      promoCode: null,

      addItem: (item, quantity = 1) => {
        const { items } = get()
        const existing = items.find((i) => i.packageId === item.packageId)
        if (existing) {
          set({
            items: items.map((i) =>
              i.packageId === item.packageId
                ? { ...i, quantity: i.quantity + quantity }
                : i
            ),
          })
        } else {
          set({ items: [...items, { ...item, quantity }] })
        }
      },

      removeItem: (packageId) => {
        set({ items: get().items.filter((i) => i.packageId !== packageId) })
      },

      updateQuantity: (packageId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(packageId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.packageId === packageId ? { ...i, quantity } : i
          ),
        })
      },

      clearCart: () => set({ items: [], promoCode: null }),

      setPromoCode: (code) => set({ promoCode: code }),

      setEvent: (eventId, eventSlug) => {
        const current = get()
        if (current.eventId !== eventId) {
          set({ items: [], eventId, eventSlug, promoCode: null })
        }
      },

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalSeats: () =>
        get().items.reduce((sum, i) => sum + i.quantity * i.seatsPerPackage, 0),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
      hasSponsorship: () => get().items.some((i) => i.isSponsorship),
    }),
    {
      name: 'fundrbolt-ticket-cart',
    }
  )
)
