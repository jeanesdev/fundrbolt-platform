import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock the useInstallPrompt hook
const mockPromptInstall = vi.fn()
const mockDismiss = vi.fn()
const mockInstallPrompt = {
  canShow: false,
  isIOS: false,
  isInstalled: false,
  promptInstall: mockPromptInstall,
  dismiss: mockDismiss,
}

vi.mock('../use-install-prompt', () => ({
  useInstallPrompt: vi.fn(() => mockInstallPrompt),
}))

import { InstallPromptBanner } from '../install-prompt-banner'

describe('InstallPromptBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockInstallPrompt.canShow = false
    mockInstallPrompt.isIOS = false
    mockInstallPrompt.isInstalled = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when canShow is false', () => {
    mockInstallPrompt.canShow = false
    const { container } = render(<InstallPromptBanner appId="test" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing before showDelay elapses', () => {
    mockInstallPrompt.canShow = true
    const { container } = render(
      <InstallPromptBanner appId="test" showDelay={5000} />,
    )
    // Before the delay
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('renders after showDelay elapses when canShow is true', async () => {
    mockInstallPrompt.canShow = true
    render(<InstallPromptBanner appId="test" showDelay={100} />)
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByRole('alert')).toBeDefined()
  })

  it('shows iOS instructions when isIOS is true', async () => {
    mockInstallPrompt.canShow = true
    mockInstallPrompt.isIOS = true
    render(<InstallPromptBanner appId="test" showDelay={0} />)
    await act(async () => {
      vi.advanceTimersByTime(10)
    })
    expect(screen.getByText(/Add to Home Screen/)).toBeDefined()
  })
})
