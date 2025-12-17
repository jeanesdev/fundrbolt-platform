/**
 * Seating Management Store
 *
 * Manages state for drag-and-drop table assignments with optimistic updates and rollback.
 */

import {
  assignGuestToTable,
  getSeatingGuests,
  getTableOccupancy,
  removeGuestFromTable,
  type GuestSeatingInfo
} from '@/lib/api/admin-seating'
import { toast } from 'sonner'
import { create } from 'zustand'

interface SeatingState {
  // Table assignments: tableNumber -> list of guests
  tables: Map<number, GuestSeatingInfo[]>

  // Unassigned guests
  unassignedGuests: GuestSeatingInfo[]

  // Loading states
  isLoading: boolean
  isDragging: boolean

  // Event context
  eventId: string | null
  maxGuestsPerTable: number
  tableCount: number

  // Optimistic update rollback
  rollbackState: {
    tables: Map<number, GuestSeatingInfo[]>
    unassignedGuests: GuestSeatingInfo[]
  } | null
}

interface SeatingActions {
  // Initialize store with event data
  initialize: (eventId: string, tableCount: number, maxGuestsPerTable: number) => void

  // Load all guests and their assignments
  loadGuests: () => Promise<void>

  // Load specific table occupancy
  loadTableOccupancy: (tableNumber: number) => Promise<void>

  // Assign guest to table (optimistic)
  assignGuestToTable: (guestId: string, tableNumber: number) => Promise<void>

  // Remove guest from table (optimistic)
  removeGuestFromTable: (guestId: string) => Promise<void>

  // Drag-and-drop state
  setDragging: (isDragging: boolean) => void

  // Rollback optimistic update on error
  rollback: () => void

  // Clear all state
  reset: () => void
}

type SeatingStore = SeatingState & SeatingActions

const initialState: SeatingState = {
  tables: new Map(),
  unassignedGuests: [],
  isLoading: false,
  isDragging: false,
  eventId: null,
  maxGuestsPerTable: 0,
  tableCount: 0,
  rollbackState: null,
}

export const useSeatingStore = create<SeatingStore>((set, get) => ({
  ...initialState,

  initialize: (eventId, tableCount, maxGuestsPerTable) => {
    set({
      eventId,
      tableCount,
      maxGuestsPerTable,
      tables: new Map(Array.from({ length: tableCount }, (_, i) => [i + 1, []])),
      unassignedGuests: [],
    })
  },

  loadGuests: async () => {
    const { eventId, tableCount } = get()
    if (!eventId) {
      return
    }

    set({ isLoading: true })

    try {
      // Load all guests with pagination (max 200 per page)
      const response = await getSeatingGuests(eventId, 1, 200)
      const allGuests = response.guests

      // Organize guests by table
      const tables = new Map<number, GuestSeatingInfo[]>(
        Array.from({ length: tableCount }, (_, i) => [i + 1, []])
      )
      const unassigned: GuestSeatingInfo[] = []

      for (const guest of allGuests) {
        if (guest.table_number) {
          const tableGuests = tables.get(guest.table_number) || []
          tableGuests.push(guest)
          tables.set(guest.table_number, tableGuests)
        } else {
          unassigned.push(guest)
        }
      }

      set({ tables, unassignedGuests: unassigned, isLoading: false })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to load guest seating information: ${errorMessage}`)
      set({ isLoading: false })
    }
  },

  loadTableOccupancy: async (tableNumber: number) => {
    const { eventId, tables } = get()
    if (!eventId) return

    try {
      const occupancy = await getTableOccupancy(eventId, tableNumber)
      const newTables = new Map(tables)
      newTables.set(tableNumber, occupancy.guests)
      set({ tables: newTables })
    } catch {
      toast.error(`Failed to load table ${tableNumber} occupancy`)
    }
  },

  assignGuestToTable: async (guestId: string, tableNumber: number) => {
    const { eventId, tables, unassignedGuests, maxGuestsPerTable } = get()
    if (!eventId) return

    // Find guest
    let guest: GuestSeatingInfo | undefined
    let previousTableNumber: number | null = null

    // Check unassigned
    guest = unassignedGuests.find((g) => g.guest_id === guestId)
    if (!guest) {
      // Check all tables
      for (const [tableNum, guests] of tables.entries()) {
        guest = guests.find((g) => g.guest_id === guestId)
        if (guest) {
          previousTableNumber = tableNum
          break
        }
      }
    }

    if (!guest) {
      toast.error('Guest not found')
      return
    }

    // Check capacity
    const targetTableGuests = tables.get(tableNumber) || []
    if (targetTableGuests.length >= maxGuestsPerTable) {
      toast.error(`Table ${tableNumber} is at capacity (${maxGuestsPerTable} guests)`)
      return
    }

    // Save rollback state
    set({
      rollbackState: {
        tables: new Map(tables),
        unassignedGuests: [...unassignedGuests],
      },
    })

    // Optimistic update
    const newTables = new Map(tables)
    const newUnassigned = [...unassignedGuests]

    // Remove from previous location
    if (previousTableNumber !== null) {
      const previousGuests = newTables.get(previousTableNumber) || []
      newTables.set(
        previousTableNumber,
        previousGuests.filter((g) => g.guest_id !== guestId)
      )
    } else {
      const index = newUnassigned.findIndex((g) => g.guest_id === guestId)
      if (index !== -1) {
        newUnassigned.splice(index, 1)
      }
    }

    // Add to new table
    const updatedGuest = { ...guest, table_number: tableNumber }
    const newTableGuests = newTables.get(tableNumber) || []
    newTableGuests.push(updatedGuest)
    newTables.set(tableNumber, newTableGuests)

    set({ tables: newTables, unassignedGuests: newUnassigned })

    // Make API call
    try {
      await assignGuestToTable(eventId, guestId, tableNumber)
      toast.success(`${guest.name || 'Guest'} assigned to Table ${tableNumber}`)
      set({ rollbackState: null })
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to assign guest to table'
      toast.error(errorMessage)
      get().rollback()
    }
  },

  removeGuestFromTable: async (guestId: string) => {
    const { eventId, tables, unassignedGuests } = get()
    if (!eventId) return

    // Find guest in tables
    let guest: GuestSeatingInfo | undefined
    let previousTableNumber: number | null = null

    for (const [tableNum, guests] of tables.entries()) {
      guest = guests.find((g) => g.guest_id === guestId)
      if (guest) {
        previousTableNumber = tableNum
        break
      }
    }

    if (!guest || previousTableNumber === null) {
      toast.error('Guest not found in any table')
      return
    }

    // Save rollback state
    set({
      rollbackState: {
        tables: new Map(tables),
        unassignedGuests: [...unassignedGuests],
      },
    })

    // Optimistic update
    const newTables = new Map(tables)
    const newUnassigned = [...unassignedGuests]

    // Remove from table
    const tableGuests = newTables.get(previousTableNumber) || []
    newTables.set(
      previousTableNumber,
      tableGuests.filter((g) => g.guest_id !== guestId)
    )

    // Add to unassigned
    const updatedGuest = { ...guest, table_number: null }
    newUnassigned.push(updatedGuest)

    set({ tables: newTables, unassignedGuests: newUnassigned })

    // Make API call
    try {
      await removeGuestFromTable(eventId, guestId)
      toast.success(`${guest.name || 'Guest'} removed from table`)
      set({ rollbackState: null })
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to remove guest from table'
      toast.error(errorMessage)
      get().rollback()
    }
  },

  setDragging: (isDragging) => {
    set({ isDragging })
  },

  rollback: () => {
    const { rollbackState } = get()
    if (rollbackState) {
      set({
        tables: rollbackState.tables,
        unassignedGuests: rollbackState.unassignedGuests,
        rollbackState: null,
      })
      toast.info('Changes reverted')
    }
  },

  reset: () => {
    set(initialState)
  },
}))
