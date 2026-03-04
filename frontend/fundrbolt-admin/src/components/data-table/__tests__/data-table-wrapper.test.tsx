/**
 * DataTableWrapper & useDataTableView Tests (T050)
 *
 * Tests view mode switching, toggle rendering, and localStorage integration.
 */
import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTableWrapper, useDataTableView } from '../data-table-wrapper'

// Mock useViewPreference used by DataTableWrapper and useDataTableView
const mockSetViewMode = vi.fn()
let mockViewMode: 'table' | 'card' = 'table'

vi.mock('@/hooks/use-view-preference', () => ({
  useViewPreference: vi.fn(() => [mockViewMode, mockSetViewMode]),
}))

describe('DataTableWrapper', () => {
  beforeEach(() => {
    mockViewMode = 'table'
    mockSetViewMode.mockClear()
  })

  it('renders table view (children) when mode is "table"', () => {
    mockViewMode = 'table'
    render(
      <DataTableWrapper
        viewPreferenceKey='test'
        renderCards={() => <div data-testid='card-view'>Cards</div>}
      >
        <div data-testid='table-view'>Table</div>
      </DataTableWrapper>
    )

    expect(screen.getByTestId('table-view')).toBeInTheDocument()
    expect(screen.queryByTestId('card-view')).not.toBeInTheDocument()
  })

  it('renders card view when mode is "card"', () => {
    mockViewMode = 'card'
    render(
      <DataTableWrapper
        viewPreferenceKey='test'
        renderCards={() => <div data-testid='card-view'>Cards</div>}
      >
        <div data-testid='table-view'>Table</div>
      </DataTableWrapper>
    )

    expect(screen.getByTestId('card-view')).toBeInTheDocument()
    expect(screen.queryByTestId('table-view')).not.toBeInTheDocument()
  })

  it('renders the view toggle buttons', () => {
    render(
      <DataTableWrapper
        viewPreferenceKey='test'
        renderCards={() => <div>Cards</div>}
      >
        <div>Table</div>
      </DataTableWrapper>
    )

    expect(screen.getByLabelText('Table view')).toBeInTheDocument()
    expect(screen.getByLabelText('Card view')).toBeInTheDocument()
  })

  it('calls setViewMode when toggle is clicked', async () => {
    mockViewMode = 'table'
    const user = userEvent.setup()

    render(
      <DataTableWrapper
        viewPreferenceKey='test'
        renderCards={() => <div>Cards</div>}
      >
        <div>Table</div>
      </DataTableWrapper>
    )

    await user.click(screen.getByLabelText('Card view'))
    expect(mockSetViewMode).toHaveBeenCalledWith('card')
  })

  it('renders toggle via renderToggle when provided', () => {
    render(
      <DataTableWrapper
        viewPreferenceKey='test'
        renderCards={() => <div>Cards</div>}
        renderToggle={(toggle) => (
          <div data-testid='custom-toolbar'>{toggle}</div>
        )}
      >
        <div>Table</div>
      </DataTableWrapper>
    )

    expect(screen.getByTestId('custom-toolbar')).toBeInTheDocument()
    expect(screen.getByLabelText('Table view')).toBeInTheDocument()
  })
})

describe('useDataTableView', () => {
  beforeEach(() => {
    mockViewMode = 'table'
    mockSetViewMode.mockClear()
  })

  it('returns current viewMode', () => {
    mockViewMode = 'card'
    const { result } = renderHook(() => useDataTableView('test-key'))
    expect(result.current.viewMode).toBe('card')
  })

  it('returns setViewMode function', () => {
    const { result } = renderHook(() => useDataTableView('test-key'))
    expect(typeof result.current.setViewMode).toBe('function')
  })

  it('returns a ViewToggle render function', () => {
    const { result } = renderHook(() => useDataTableView('test-key'))
    expect(typeof result.current.ViewToggle).toBe('function')
  })

  it('ViewToggle renders the toggle buttons', () => {
    const { result } = renderHook(() => useDataTableView('test-key'))
    // Render the ViewToggle component returned by the hook
    const { getByLabelText } = render(<>{result.current.ViewToggle()}</>)

    expect(getByLabelText('Table view')).toBeInTheDocument()
    expect(getByLabelText('Card view')).toBeInTheDocument()
  })
})
