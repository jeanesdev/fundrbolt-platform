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
  it('renders all logos with fixed w-24 h-24 CSS class (96px) regardless of logo_size', () => {
    const sizes = [LogoSize.XSMALL, LogoSize.SMALL, LogoSize.MEDIUM, LogoSize.LARGE, LogoSize.XLARGE]

    sizes.forEach((size) => {
      const sponsor = { ...mockSponsor, logo_size: size }
      const { container, unmount } = render(<SponsorCard sponsor={sponsor} />)

      const logoContainer = container.querySelector('.w-24.h-24')
      expect(logoContainer).toBeInTheDocument()
      expect(logoContainer).toHaveClass('w-24', 'h-24')
      unmount()
    })
  })

  it('displays abbreviated logo size label badge for each size', () => {
    const sizes = [
      { size: LogoSize.XSMALL, label: 'Logo: XS' },
      { size: LogoSize.SMALL, label: 'Logo: S' },
      { size: LogoSize.MEDIUM, label: 'Logo: M' },
      { size: LogoSize.LARGE, label: 'Logo: L' },
      { size: LogoSize.XLARGE, label: 'Logo: XL' },
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

    // Only logo size badge ("Logo: M") should be present
    expect(screen.getByText('Logo: M')).toBeInTheDocument()

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

    expect(screen.getByText('Logo: XL')).toBeInTheDocument() // Logo size badge
    expect(screen.getByText('Diamond')).toBeInTheDocument() // Sponsor level badge
  })
})

describe('SponsorCard - Logo Size Defaults (T057)', () => {
  it('defaults to medium size badge (Logo: M) if invalid logo_size provided', () => {
    const sponsor = { ...mockSponsor, logo_size: 'invalid' as LogoSize }
    render(<SponsorCard sponsor={sponsor} />)

    // Component has fallback logic for badge label
    expect(screen.getByText('Logo: M')).toBeInTheDocument()
  })
})

describe('SponsorCard - Visual Rendering with Logo Sizes', () => {
  it('renders logo image with correct size class and object-contain', () => {
    const sponsor = { ...mockSponsor, logo_size: LogoSize.LARGE }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    const img = screen.getByRole('img', { name: 'Acme Corporation logo' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveClass('w-full', 'h-full', 'object-contain')

    // Parent container should have fixed w-24 h-24 class
    const logoContainer = container.querySelector('.w-24.h-24')
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

// =============================================================================
// Phase 8: User Story 5 - Link Sponsors to External Resources
// =============================================================================

describe('SponsorCard - Website URL Links (Phase 8 - User Story 5)', () => {
  it('renders clickable logo when website_url is present', () => {
    const sponsor = { ...mockSponsor, website_url: 'https://acme.example.com' }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    // Logo should be wrapped in an anchor tag
    const logoLink = container.querySelector('a[href="https://acme.example.com"]')
    expect(logoLink).toBeInTheDocument()
    expect(logoLink).toHaveAttribute('target', '_blank')
    expect(logoLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(logoLink).toHaveAttribute('aria-label', 'Visit Acme Corporation website')
  })

  it('renders clickable sponsor name when website_url is present', () => {
    const sponsor = { ...mockSponsor, website_url: 'https://acme.example.com' }
    render(<SponsorCard sponsor={sponsor} />)

    // Find the h3 heading
    const heading = screen.getByRole('heading', { name: 'Acme Corporation' })

    // Its parent should be an anchor tag
    expect(heading.parentElement?.tagName).toBe('A')
    expect(heading.parentElement).toHaveAttribute('href', 'https://acme.example.com')
    expect(heading.parentElement).toHaveAttribute('target', '_blank')
    expect(heading.parentElement).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not make logo clickable when website_url is missing', () => {
    const sponsor = { ...mockSponsor, website_url: undefined }
    const { container } = render(<SponsorCard sponsor={sponsor} />)

    // Logo container should not be wrapped in anchor (fixed w-24 h-24 size)
    const logoContainer = container.querySelector('.w-24.h-24')
    expect(logoContainer?.tagName).toBe('DIV')
    expect(logoContainer?.parentElement?.tagName).not.toBe('A')
  })

  it('does not make sponsor name clickable when website_url is missing', () => {
    const sponsor = { ...mockSponsor, website_url: undefined }
    render(<SponsorCard sponsor={sponsor} />)

    const heading = screen.getByRole('heading', { name: 'Acme Corporation' })
    expect(heading.tagName).toBe('H3')
    expect(heading.parentElement?.tagName).not.toBe('A')
  })

  it('displays "Visit Website" link when website_url is present', () => {
    const sponsor = { ...mockSponsor, website_url: 'https://acme.example.com' }
    render(<SponsorCard sponsor={sponsor} />)

    const visitLink = screen.getByRole('link', { name: /visit website/i })
    expect(visitLink).toBeInTheDocument()
    expect(visitLink).toHaveAttribute('href', 'https://acme.example.com')
    expect(visitLink).toHaveAttribute('target', '_blank')
    expect(visitLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not display "Visit Website" link when website_url is missing', () => {
    const sponsor = { ...mockSponsor, website_url: undefined }
    render(<SponsorCard sponsor={sponsor} />)

    const visitLink = screen.queryByRole('link', { name: /visit website/i })
    expect(visitLink).not.toBeInTheDocument()
  })

  it('applies hover underline style to clickable sponsor name', () => {
    const sponsor = { ...mockSponsor, website_url: 'https://acme.example.com' }
    render(<SponsorCard sponsor={sponsor} />)

    const heading = screen.getByRole('heading', { name: 'Acme Corporation' })
    expect(heading).toHaveClass('hover:underline')
  })

  it('does not apply hover underline when no website_url', () => {
    const sponsor = { ...mockSponsor, website_url: undefined }
    render(<SponsorCard sponsor={sponsor} />)

    const heading = screen.getByRole('heading', { name: 'Acme Corporation' })
    expect(heading).not.toHaveClass('hover:underline')
  })
})
