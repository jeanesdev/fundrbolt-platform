/**
 * DataTableCardView Component Tests (T049)
 *
 * Tests card rendering with mock TanStack Table, primary/secondary field split,
 * collapsible toggle, and empty state.
 */
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DataTableCardView } from '../card-view'

// ---- Test data & columns -------------------------------------------------

type TestRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
  department: string
}

const testData: TestRow[] = [
  {
    id: '1',
    name: 'Alice',
    email: 'alice@test.com',
    role: 'Admin',
    status: 'Active',
    department: 'Engineering',
  },
  {
    id: '2',
    name: 'Bob',
    email: 'bob@test.com',
    role: 'User',
    status: 'Inactive',
    department: 'Marketing',
  },
]

const col = createColumnHelper<TestRow>()

const columns = [
  col.accessor('name', { header: 'Name' }),
  col.accessor('email', { header: 'Email' }),
  col.accessor('role', { header: 'Role' }),
  col.accessor('status', { header: 'Status' }),
  col.accessor('department', { header: 'Department' }),
]

// Wrapper component that creates a real TanStack Table instance
function CardViewHarness({
  data = testData,
  primaryFieldCount,
}: {
  data?: TestRow[]
  primaryFieldCount?: number
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <DataTableCardView table={table} primaryFieldCount={primaryFieldCount} />
  )
}

// ---- Tests ---------------------------------------------------------------

describe('DataTableCardView', () => {
  it('renders a card for each data row', () => {
    render(<CardViewHarness />)

    // Both names should be visible as primary fields
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows empty state when no rows', () => {
    render(<CardViewHarness data={[]} />)
    expect(screen.getByText('No results.')).toBeInTheDocument()
  })

  it('displays primary fields directly (default: 4)', () => {
    render(<CardViewHarness />)

    // With 5 columns and primaryFieldCount=4, first 4 should be visible
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('hides secondary fields until expanded', async () => {
    render(<CardViewHarness primaryFieldCount={2} />)

    // Primary fields visible (name, email)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()

    // Secondary fields — there should be a "More details" trigger for each card
    const triggers = screen.getAllByText('More details')
    expect(triggers.length).toBe(2) // one per card
  })

  it('toggles collapsible with More/Less details', async () => {
    const user = userEvent.setup()
    render(<CardViewHarness primaryFieldCount={2} />)

    // Click first card's "More details"
    const triggers = screen.getAllByText('More details')
    await user.click(triggers[0])

    // After opening, should show "Less details"
    expect(screen.getByText('Less details')).toBeInTheDocument()

    // The secondary fields for card 1 should now be visible
    // (Role, Status, Department for Alice)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('shows column header labels in card fields', () => {
    render(<CardViewHarness />)

    // Column headers used as dt labels
    expect(screen.getAllByText('Name').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Email').length).toBeGreaterThan(0)
  })

  it('respects custom primaryFieldCount', () => {
    render(<CardViewHarness primaryFieldCount={1} />)

    // Only "name" as primary field; all others behind collapsible
    const triggers = screen.getAllByText('More details')
    expect(triggers.length).toBe(2) // 2 rows, each with collapsible
  })

  it('does not render collapsible when all fields are primary', () => {
    render(<CardViewHarness primaryFieldCount={10} />)

    // With primaryFieldCount > total columns, no collapsible shown
    expect(screen.queryByText('More details')).not.toBeInTheDocument()
  })

  it('applies custom className to the grid container', () => {
    function HarnessWithClass() {
      const table = useReactTable({
        data: testData,
        columns,
        getCoreRowModel: getCoreRowModel(),
      })
      return <DataTableCardView table={table} className='my-grid-class' />
    }

    const { container } = render(<HarnessWithClass />)
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveClass('my-grid-class')
  })
})
