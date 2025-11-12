/**
 * Tests for SponsorCard component
 * Focus: Logo size CSS classes and sponsor_level badge display (T057)
 */

import { SponsorCard } from '@/features/events/components/SponsorCard'
import { LogoSize, type Sponsor } from '@/types/sponsor'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const mockSponsor: Sponsor = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  event_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Acme Corporation',
  logo_url: 'https://example.com/logo.png',
  thumbnail_url: 'https://example.com/thumbnail.png',
  logo_blob_name: 'logos/acme.png',
  thumbnail_blob_name: 'thumbnails/acme.png',
  logo_size: LogoSize.MEDIUM,
  display_order: 0,
  website_url: 'https://acme.example.com',
  sponsor_level: undefined,
  contact_name: undefined,
  contact_email: undefined,
  contact_phone: undefined,
  address_line1: undefined,
  address_line2: undefined,
  city: undefined,
  state: undefined,
  postal_code: undefined,
  country: undefined,
  donation_amount: undefined,
  notes: undefined,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: '123e4567-e89b-12d3-a456-426614174002',
}

describe('SponsorCard - Logo Size Display (T057)', () => {
  it('renders xsmall logo with w-16 h-16 CSS class (64px)', () => {
    const sponsor = { ...mockSponsor, logo_size: LogoSize.XSMALL }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    const logoContainer = container.querySelector('.w-16.h-16')
    expect(logoContainer).toBeInTheDocument()
    expect(logoContainer).toHaveClass('w-16', 'h-16')
  })

  it('renders small logo with w-24 h-24 CSS class (96px)', () => {
    const sponsor = { ...mockSponsor, logo_size: LogoSize.SMALL }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    const logoContainer = container.querySelector('.w-24.h-24')
    expect(logoContainer).toBeInTheDocument()
    expect(logoContainer).toHaveClass('w-24', 'h-24')
  })

  it('renders medium logo with w-32 h-32 CSS class (128px)', () => {
    const sponsor = { ...mockSponsor, logo_size: LogoSize.MEDIUM }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    const logoContainer = container.querySelector('.w-32.h-32')
    expect(logoContainer).toBeInTheDocument()
    expect(logoContainer).toHaveClass('w-32', 'h-32')
  })

  it('renders large logo with w-48 h-48 CSS class (192px)', () => {
    const sponsor = { ...mockSponsor, logo_size: LogoSize.LARGE }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    const logoContainer = container.querySelector('.w-48.h-48')
    expect(logoContainer).toBeInTheDocument()
    expect(logoContainer).toHaveClass('w-48', 'h-48')
  })

  it('renders xlarge logo with w-64 h-64 CSS class (256px)', () => {
    const sponsor = { ...mockSponsor, logo_size: LogoSize.XLARGE }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    const logoContainer = container.querySelector('.w-64.h-64')
    expect(logoContainer).toBeInTheDocument()
    expect(logoContainer).toHaveClass('w-64', 'h-64')
  })

  it('displays logo size label badge for each size', () => {
    const sizes = [
      { size: LogoSize.XSMALL, label: 'Extra Small' },
      { size: LogoSize.SMALL, label: 'Small' },
      { size: LogoSize.MEDIUM, label: 'Medium' },
      { size: LogoSize.LARGE, label: 'Large' },
      { size: LogoSize.XLARGE, label: 'Extra Large' },
    ]

    sizes.forEach(({ size, label }) => {
      const sponsor = { ...mockSponsor, logo_size: size }
      const { unmount } = render(<SponsorCard sponsor={sponsor} />)

      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    })
  })
})

describe('SponsorCard - Sponsor Level Badge Display (T057)', () => {
  it('renders sponsor_level badge when provided', () => {
    const sponsor = { ...mockSponsor, sponsor_level: 'Platinum' }
    render(<SponsorCard sponsor={sponsor} />)

    const badge = screen.getByText('Platinum')
    expect(badge).toBeInTheDocument()
  })

  it('renders sponsor_level badge for various tier names', () => {
    const tiers = ['Gold', 'Silver', 'Bronze', 'Diamond', 'Title Sponsor']

    tiers.forEach((tier) => {
      const sponsor = { ...mockSponsor, sponsor_level: tier }
      const { unmount } = render(<SponsorCard sponsor={sponsor} />)

      expect(screen.getByText(tier)).toBeInTheDocument()
      unmount()
    })
  })

  it('does not render sponsor_level badge when undefined', () => {
    const sponsor = { ...mockSponsor, sponsor_level: undefined }
    render(<SponsorCard sponsor={sponsor} />)

    // Badge component should not exist (check for specific variant)
    const badges = screen.queryAllByText(/Platinum|Gold|Silver/i)
    expect(badges).toHaveLength(0)
  })

  it('does not render sponsor_level badge when empty string', () => {
    const sponsor = { ...mockSponsor, sponsor_level: '' }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    // Only logo size badge ("Medium") should be present
    expect(screen.getByText('Medium')).toBeInTheDocument()

    // Verify sponsor_level Badge doesn't render (conditional on sponsor_level truthy check)
    // Component code: {sponsor.sponsor_level && <Badge ...>{sponsor.sponsor_level}</Badge>}
    // When sponsor_level is empty string, it's falsy, so badge won't render
    const sponsorName = container.querySelector('h3')
    const sponsorInfo = sponsorName?.parentElement?.parentElement
    const badges = sponsorInfo?.querySelectorAll('[data-slot="badge"]')
    expect(badges?.length).toBe(1) // Only logo size badge
  })

  it('renders both logo size and sponsor_level badges when both present', () => {
    const sponsor = {
      ...mockSponsor,
      logo_size: LogoSize.XLARGE,
      sponsor_level: 'Diamond',
    }
    render(<SponsorCard sponsor={sponsor} />)

    expect(screen.getByText('Extra Large')).toBeInTheDocument() // Logo size badge
    expect(screen.getByText('Diamond')).toBeInTheDocument() // Sponsor level badge
  })
})

describe('SponsorCard - Logo Size Defaults (T057)', () => {
  it('defaults to medium size (w-32) if invalid logo_size provided', () => {
    const sponsor = { ...mockSponsor, logo_size: 'invalid' as LogoSize }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    // Component has fallback logic: logoSizeClasses[sponsor.logo_size] || logoSizeClasses.medium
    const logoContainer = container.querySelector('.w-32.h-32')
    expect(logoContainer).toBeInTheDocument()
  })
})

describe('SponsorCard - Visual Rendering with Logo Sizes', () => {
  it('renders logo image with correct size class and object-contain', () => {
    const sponsor = { ...mockSponsor, logo_size: LogoSize.LARGE }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    const img = screen.getByRole('img', { name: 'Acme Corporation logo' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveClass('w-full', 'h-full', 'object-contain')

    // Parent container should have size class
    const logoContainer = container.querySelector('.w-48.h-48')
    expect(logoContainer).toContainElement(img)
  })

  it('renders placeholder icon when no logo_url or thumbnail_url', () => {
    const sponsor = {
      ...mockSponsor,
      logo_url: '',
      thumbnail_url: '',
      logo_size: LogoSize.SMALL,
    }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    // Building2 icon should be present
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('text-muted-foreground')
  })

  it('uses thumbnail_url when available (preferred over logo_url)', () => {
    const sponsor = {
      ...mockSponsor,
      logo_url: 'https://example.com/large.png',
      thumbnail_url: 'https://example.com/thumb.png',
    }
    render(<SponsorCard sponsor={sponsor} />)

    const img = screen.getByRole('img', { name: 'Acme Corporation logo' })
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.png')
  })

  it('falls back to logo_url when thumbnail_url is empty', () => {
    const sponsor = {
      ...mockSponsor,
      logo_url: 'https://example.com/large.png',
      thumbnail_url: '',
    }
    render(<SponsorCard sponsor={sponsor} />)

    const img = screen.getByRole('img', { name: 'Acme Corporation logo' })
    expect(img).toHaveAttribute('src', 'https://example.com/large.png')
  })
})
