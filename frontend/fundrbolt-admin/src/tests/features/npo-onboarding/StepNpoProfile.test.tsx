import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StepNpoProfile } from '@/features/npo-onboarding/StepNpoProfile'

describe('StepNpoProfile', () => {
  it('allows backspacing past the EIN dash', async () => {
    const user = userEvent.setup()

    render(
      <StepNpoProfile
        sessionToken='session-token'
        onNext={vi.fn()}
        initialValues={{ ein: '' }}
      />
    )

    const einInput = screen.getByLabelText(
      /ein \(employer identification number\)/i
    )

    await user.type(einInput, '123')
    expect(einInput).toHaveValue('12-3')

    await user.type(einInput, '{backspace}')
    expect(einInput).toHaveValue('12')

    await user.type(einInput, '{backspace}')
    expect(einInput).toHaveValue('1')
  })
})
