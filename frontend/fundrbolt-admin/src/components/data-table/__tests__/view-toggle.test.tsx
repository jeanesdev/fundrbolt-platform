/**
 * DataTableViewToggle Component Tests (T048)
 *
 * Tests rendering, active state, and onChange callback for the view toggle.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTableViewToggle } from '../view-toggle'

describe('DataTableViewToggle', () => {
  it('renders two buttons (table and card)', () => {
    render(<DataTableViewToggle value='table' onChange={vi.fn()} />)

    expect(screen.getByLabelText('Table view')).toBeInTheDocument()
    expect(screen.getByLabelText('Card view')).toBeInTheDocument()
  })

  it('marks table button as pressed when value is "table"', () => {
    render(<DataTableViewToggle value='table' onChange={vi.fn()} />)

    expect(screen.getByLabelText('Table view')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByLabelText('Card view')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('marks card button as pressed when value is "card"', () => {
    render(<DataTableViewToggle value='card' onChange={vi.fn()} />)

    expect(screen.getByLabelText('Card view')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByLabelText('Table view')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('calls onChange("card") when card button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DataTableViewToggle value='table' onChange={onChange} />)

    await user.click(screen.getByLabelText('Card view'))
    expect(onChange).toHaveBeenCalledWith('card')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange("table") when table button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DataTableViewToggle value='card' onChange={onChange} />)

    await user.click(screen.getByLabelText('Table view'))
    expect(onChange).toHaveBeenCalledWith('table')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('applies additional className', () => {
    const { container } = render(
      <DataTableViewToggle
        value='table'
        onChange={vi.fn()}
        className='my-custom-class'
      />
    )

    const group = container.querySelector('[role="group"]')
    expect(group).toHaveClass('my-custom-class')
  })

  it('has correct role="group" on container', () => {
    render(<DataTableViewToggle value='table' onChange={vi.fn()} />)
    expect(screen.getByRole('group')).toBeInTheDocument()
  })
})
