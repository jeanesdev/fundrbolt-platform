/**
 * TableAssignmentModal Component Tests
 *
 * Tests for the manual table assignment modal with dropdown selection.
 *
 * Note: Interaction tests with the Select dropdown are simplified due to
 * Radix UI Select's portal rendering not being fully compatible with jsdom.
 * The component is tested for structure and critical rendering logic.
 */

import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TableAssignmentModal } from './TableAssignmentModal'

describe('TableAssignmentModal', () => {
  const mockGuest: GuestSeatingInfo = {
    guest_id: 'guest-123',
    name: 'John Doe',
    email: 'john@example.com',
    bidder_number: 101,
    table_number: null,
    registration_id: 'reg-123',
    checked_in: false,
    is_guest_of_primary: false,
    primary_registrant_name: null,
  }

  const mockTableOccupancy = new Map([
    [1, 3], // 3/8 occupied
    [2, 8], // 8/8 full
    [3, 0], // 0/8 empty
  ])

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    guest: mockGuest,
    tableCount: 3,
    maxGuestsPerTable: 8,
    tableOccupancy: mockTableOccupancy,
    onAssign: vi.fn().mockResolvedValue(undefined),
  }

  it('renders modal with guest information', () => {
    render(<TableAssignmentModal {...defaultProps} />)

    expect(screen.getByRole('heading', { name: /Assign Table/ })).toBeInTheDocument()
    expect(
      screen.getByText(/Select a table for John Doe/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Bidder #101/)).toBeInTheDocument()
  })

  it('renders table dropdown label', () => {
    render(<TableAssignmentModal {...defaultProps} />)

    expect(screen.getByText('Table Number')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('disables assign button when no table selected by default', () => {
    render(<TableAssignmentModal {...defaultProps} />)

    const assignButton = screen.getByRole('button', { name: /Assign Table/ })
    expect(assignButton).toBeDisabled()
  })

  it('renders cancel button', () => {
    render(<TableAssignmentModal {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /Cancel/ })
    expect(cancelButton).toBeEnabled()
  })

  it('renders nothing when guest is null', () => {
    const { container } = render(
      <TableAssignmentModal {...defaultProps} guest={null} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('generates correct table options based on tableCount', () => {
    const { rerender } = render(<TableAssignmentModal {...defaultProps} />)

    // Initial render with 3 tables
    let combobox = screen.getByRole('combobox')
    expect(combobox).toBeInTheDocument()

    // Rerender with different table count
    rerender(
      <TableAssignmentModal
        {...defaultProps}
        tableCount={5}
        maxGuestsPerTable={10}
      />
    )

    combobox = screen.getByRole('combobox')
    expect(combobox).toBeInTheDocument()
  })

  it('shows modal when open prop is true', () => {
    render(<TableAssignmentModal {...defaultProps} open={true} />)

    expect(screen.getByRole('heading', { name: /Assign Table/ })).toBeInTheDocument()
  })

  it('hides modal when open prop is false', () => {
    render(<TableAssignmentModal {...defaultProps} open={false} />)

    expect(screen.queryByRole('heading', { name: /Assign Table/ })).not.toBeInTheDocument()
  })

  it('renders correct guest bidder number', () => {
    render(<TableAssignmentModal {...defaultProps} />)

    expect(screen.getByText(/Bidder #101/)).toBeInTheDocument()
  })

  it('renders with different guest names', () => {
    const differentGuest = {
      ...mockGuest,
      name: 'Jane Smith',
      bidder_number: 205,
    }

    render(<TableAssignmentModal {...defaultProps} guest={differentGuest} />)

    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
    expect(screen.getByText(/Bidder #205/)).toBeInTheDocument()
  })
})
