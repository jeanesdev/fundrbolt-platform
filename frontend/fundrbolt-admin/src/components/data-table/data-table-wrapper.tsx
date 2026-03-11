import type { ReactNode } from 'react'
import { useViewPreference, type ViewMode } from '@/hooks/use-view-preference'
import { DataTableViewToggle } from './view-toggle'

type DataTableWrapperProps = {
  /** localStorage key for this page's view preference */
  viewPreferenceKey: string
  /** Render the traditional table view */
  children: ReactNode
  /** Render the card view (shown when in card mode) */
  renderCards: () => ReactNode
  /** Where to render the toggle; if not provided, renders it inline before the content */
  renderToggle?: (toggle: ReactNode) => ReactNode
}

/**
 * Wrapper that combines a table view and card view with a toggle.
 *
 * Usage:
 * ```tsx
 * <DataTableWrapper
 *   viewPreferenceKey="users"
 *   renderCards={() => <DataTableCardView table={table} />}
 * >
 *   <Table>...</Table>
 * </DataTableWrapper>
 * ```
 *
 * If you need to place the toggle somewhere specific (e.g., in a toolbar),
 * use the `renderToggle` prop, or use `useViewPreference` + `DataTableViewToggle`
 * directly for full control.
 */
export function DataTableWrapper({
  viewPreferenceKey,
  children,
  renderCards,
  renderToggle,
}: DataTableWrapperProps) {
  const [viewMode, setViewMode] = useViewPreference(viewPreferenceKey)

  const toggle = <DataTableViewToggle value={viewMode} onChange={setViewMode} />

  return (
    <>
      {renderToggle ? (
        renderToggle(toggle)
      ) : (
        <div className='flex justify-end'>{toggle}</div>
      )}
      {viewMode === 'card' ? renderCards() : children}
    </>
  )
}

/**
 * Hook-based approach for pages that need more control over toggle placement.
 * Returns the current view mode, setter, and a pre-built toggle component.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDataTableView(viewPreferenceKey: string): {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  ViewToggle: () => ReactNode
} {
  const [viewMode, setViewMode] = useViewPreference(viewPreferenceKey)

  const ViewToggle = () => (
    <DataTableViewToggle value={viewMode} onChange={setViewMode} />
  )

  return { viewMode, setViewMode, ViewToggle }
}
