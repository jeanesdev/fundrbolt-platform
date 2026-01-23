import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InitialAvatar } from '../initial-avatar'
import { useInitialAvatar } from '@/hooks/use-initial-avatar'

vi.mock('@/hooks/use-initial-avatar')

describe('InitialAvatar', () => {
  const mockUseInitialAvatar = vi.mocked(useInitialAvatar)

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseInitialAvatar.mockReturnValue({
      initials: 'EV',
      bgColor: '#123456',
      textColor: '#ffffff',
      hasBorder: false,
    })
  })

  it('renders initials with accessible label and inline styles', () => {
    render(
      <InitialAvatar
        name='Event Vision'
        brandingPrimaryColor='#0088cc'
      />
    )

    const avatar = screen.getByLabelText('Event Vision avatar')
    expect(avatar).toHaveTextContent('EV')
    expect(avatar).toHaveStyle({
      backgroundColor: '#123456',
      color: '#ffffff',
    })
  })

  it('applies size-specific classes', () => {
    render(
      <InitialAvatar
        name='Small Event'
        brandingPrimaryColor='#0088cc'
        size='sm'
      />
    )

    const avatar = screen.getByLabelText('Small Event avatar')
    expect(avatar.className).toContain('h-6')
    expect(avatar.className).toContain('w-6')
  })

  it('adds border styles when hook requests it', () => {
    mockUseInitialAvatar.mockReturnValueOnce({
      initials: 'BC',
      bgColor: '#000000',
      textColor: '#ffffff',
      hasBorder: true,
    })

    render(
      <InitialAvatar
        name='Border Case'
        brandingPrimaryColor='#000000'
      />
    )

    const avatar = screen.getByLabelText('Border Case avatar')
    expect(avatar.className).toContain('border-2')
    expect(avatar.className).toContain('border-border')
  })

  it('merges custom class names', () => {
    render(
      <InitialAvatar
        name='Custom Event'
        brandingPrimaryColor='#222222'
        className='data-test'
      />
    )

    const avatar = screen.getByLabelText('Custom Event avatar')
    expect(avatar.className).toContain('data-test')
  })
})
