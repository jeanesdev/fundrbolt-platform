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
import {
  fetchEventTables,
  updateTableDetails,
  type EventTableDetails
} from '@/services/seating-service'
import { toast } from 'sonner'
import { create } from 'zustand'

interface SeatingState {
  // Table assignments: tableNumber -> list of guests
  tables: Map<number, GuestSeatingInfo[]>

  // Table customization details (Feature 014)
  tableDetails: Map<number, EventTableDetails>

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
    tableDetails: Map<number, EventTableDetails>
  } | null
}

interface SeatingActions {
  // Initialize store with event data
  initialize: (eventId: string, tableCount: number, maxGuestsPerTable: number) => void

  // Load all guests and their assignments
  loadGuests: () => Promise<void>

  // Load table customization details (Feature 014)
  loadTableDetails: () => Promise<void>

  // Load specific table occupancy
  loadTableOccupancy: (tableNumber: number) => Promise<void>

  // Assign guest to table (optimistic)
  assignGuestToTable: (guestId: string, tableNumber: number) => Promise<void>

  // Remove guest from table (optimistic)
  removeGuestFromTable: (guestId: string) => Promise<void>

  // Update table customization (Feature 014, optimistic)
  updateTableCustomization: (
    tableNumber: number,
    updates: { custom_capacity?: number | null; table_name?: string | null }
  ) => Promise<void>

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
  tableDetails: new Map(),
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

      // Load table details after guests are loaded
      await get().loadTableDetails()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to load guest seating information: ${errorMessage}`)
      set({ isLoading: false })
    }
  },

  loadTableDetails: async () => {
    const { eventId } = get()
    if (!eventId) return

    try {
      const response = await fetchEventTables(eventId, false)
      const details = new Map<number, EventTableDetails>()

      for (const table of response.tables) {
        details.set(table.table_number, table)
      }

      set({ tableDetails: details })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to load table details: ${errorMessage}`)
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
    const { eventId, tables, unassignedGuests, tableDetails } = get()
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

    // Check capacity using table details (Feature 014)
    const tableDetail = tableDetails.get(tableNumber)
    const maxCapacity = tableDetail?.effective_capacity ?? get().maxGuestsPerTable
    const targetTableGuests = tables.get(tableNumber) || []

    if (targetTableGuests.length >= maxCapacity) {
      toast.error(`Table ${tableNumber} is at capacity (${maxCapacity} guests)`)
      return
    }

    // Save rollback state
    set({
      rollbackState: {
        tables: new Map(tables),
        unassignedGuests: [...unassignedGuests],
        tableDetails: new Map(tableDetails),
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

    // Update table details occupancy (optimistic)
    const newTableDetails = new Map(tableDetails)
    if (tableDetail) {
      newTableDetails.set(tableNumber, {
        ...tableDetail,
        current_occupancy: newTableGuests.length,
        is_full: newTableGuests.length >= maxCapacity,
      })
    }

    set({ tables: newTables, unassignedGuests: newUnassigned, tableDetails: newTableDetails })

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
    const { eventId, tables, unassignedGuests, tableDetails } = get()
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
        tableDetails: new Map(tableDetails),
      },
    })

    // Optimistic update
    const newTables = new Map(tables)
    const newUnassigned = [...unassignedGuests]

    // Remove from table
    const tableGuests = newTables.get(previousTableNumber) || []
    const updatedTableGuests = tableGuests.filter((g) => g.guest_id !== guestId)
    newTables.set(previousTableNumber, updatedTableGuests)

    // Add to unassigned
    const updatedGuest = { ...guest, table_number: null }
    newUnassigned.push(updatedGuest)

    // Update table details occupancy (optimistic)
    const newTableDetails = new Map(tableDetails)
    const tableDetail = tableDetails.get(previousTableNumber)
    if (tableDetail) {
      const maxCapacity = tableDetail.effective_capacity
      newTableDetails.set(previousTableNumber, {
        ...tableDetail,
        current_occupancy: updatedTableGuests.length,
        is_full: updatedTableGuests.length >= maxCapacity,
      })
    }

    set({ tables: newTables, unassignedGuests: newUnassigned, tableDetails: newTableDetails })

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

  updateTableCustomization: async (
    tableNumber: number,
    updates: { custom_capacity?: number | null; table_name?: string | null }
  ) => {
    const { eventId, tableDetails } = get()
    if (!eventId) return

    const currentDetail = tableDetails.get(tableNumber)
    if (!currentDetail) {
      toast.error(`Table ${tableNumber} details not found`)
      return
    }

    // Save rollback state
    set({
      rollbackState: {
        tables: new Map(get().tables),
        unassignedGuests: [...get().unassignedGuests],
        tableDetails: new Map(tableDetails),
      },
    })

    // Optimistic update
    const newTableDetails = new Map(tableDetails)
    const updatedDetail: EventTableDetails = {
      ...currentDetail,
      custom_capacity: updates.custom_capacity ?? currentDetail.custom_capacity,
      table_name: updates.table_name ?? currentDetail.table_name,
    }

    // Recalculate effective capacity and is_full
    updatedDetail.effective_capacity =
      updatedDetail.custom_capacity ?? get().maxGuestsPerTable
    updatedDetail.is_full =
      updatedDetail.current_occupancy >= updatedDetail.effective_capacity

    newTableDetails.set(tableNumber, updatedDetail)
    set({ tableDetails: newTableDetails })

    // Make API call
    try {
      const result = await updateTableDetails(eventId, tableNumber, updates)

      // Update with server response
      const finalTableDetails = new Map(get().tableDetails)
      finalTableDetails.set(tableNumber, result)
      set({ tableDetails: finalTableDetails, rollbackState: null })

      toast.success(`Table ${tableNumber} customization updated`)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update table customization'
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
        tableDetails: rollbackState.tableDetails,
        rollbackState: null,
      })
      toast.info('Changes reverted')
    }
  },

  reset: () => {
    set(initialState)
  },
}))
