import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateNotification } from '../update-notification'

describe('UpdateNotification', () => {
  it('renders when needRefresh is true', () => {
    render(
      <UpdateNotification
        needRefresh={true}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText('A new version is available.')).toBeDefined()
  })

  it('does not render when needRefresh is false', () => {
    const { container } = render(
      <UpdateNotification
        needRefresh={false}
        onRefresh={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('calls onRefresh when "Refresh to update" is clicked', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(
      <UpdateNotification
        needRefresh={true}
        onRefresh={onRefresh}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Refresh to update'))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <UpdateNotification
        needRefresh={true}
        onRefresh={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    fireEvent.click(screen.getByLabelText('Dismiss update notification'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
